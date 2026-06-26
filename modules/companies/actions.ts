"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { settingsContext, requireUser, requirePlatformAdmin } from "@/modules/auth/queries";
import { slugify } from "@/lib/utils";
import { seedCompanyStarter } from "@/lib/setup/seed";
import { sendBrandedEmail } from "@/lib/comms/branded";

/** Build an absolute accept-invite URL from the incoming request host. */
async function acceptUrl(token: string): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "joincarenow.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/accept-invite?token=${token}`;
}

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const optionalHex = z
  .string()
  .trim()
  .refine((v) => v === "" || HEX.test(v), "Enter a valid colour")
  .optional();

const createCompanySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters").max(120),
  adminName: z.string().trim().min(2, "Enter the administrator's name").max(120),
  adminRole: z.string().trim().max(120).optional(),
  adminEmail: z.string().email("Enter a valid admin email address"),
  adminPhone: z.string().trim().max(40).optional(),
  plan: z.enum(["monthly", "commit", "annual", "diamond"]).default("monthly"),
  brandPrimary: optionalHex,
  brandSecondary: optionalHex,
  brandAccent: optionalHex,
});

/** Build the free-text concession string parseConcession understands from the
 *  founder's structured offer inputs (free months / custom £ / extra SMS). */
function buildOffer(fd: FormData): string {
  const parts: string[] = [];
  const months = parseInt(String(fd.get("offerFreeMonths") ?? ""), 10);
  const price = parseFloat(String(fd.get("offerCustomPrice") ?? ""));
  const sms = parseInt(String(fd.get("offerExtraSms") ?? ""), 10);
  if (Number.isFinite(months) && months > 0) parts.push(`${Math.min(12, months)} months free`);
  if (Number.isFinite(price) && price > 0) parts.push(`£${price.toFixed(2)}/mo`);
  if (Number.isFinite(sms) && sms > 0) parts.push(`+${sms} SMS`);
  return parts.join(", ");
}

export type CompanyState =
  | { error?: string; inviteLink?: string; invitedEmail?: string }
  | undefined;

/** Founder-only (enforced in the create_company / create_invitation RPCs).
 *  Creates the company AND invites its first admin in one step. */
export async function createCompany(
  _prev: CompanyState,
  formData: FormData
): Promise<CompanyState> {
  const parsed = createCompanySchema.safeParse({
    name: formData.get("name"),
    adminName: formData.get("adminName"),
    adminRole: formData.get("adminRole") ?? undefined,
    adminEmail: formData.get("adminEmail"),
    adminPhone: formData.get("adminPhone") ?? undefined,
    plan: formData.get("plan") ?? "monthly",
    brandPrimary: formData.get("brandPrimary") ?? undefined,
    brandSecondary: formData.get("brandSecondary") ?? undefined,
    brandAccent: formData.get("brandAccent") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }
  const agreedOffer = buildOffer(formData);

  const supabase = await createClient();
  const baseSlug = slugify(parsed.data.name);
  if (!baseSlug) return { error: "Company name must contain letters or numbers" };

  // 1. Create the company (retry slug if taken). RPC returns its new id.
  let companyId: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug =
      attempt === 0
        ? baseSlug
        : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;

    const { data, error } = await supabase.rpc("create_company", {
      company_name: parsed.data.name,
      company_slug: slug,
    });

    if (!error) {
      companyId = data as string;
      break;
    }
    if (!error.message.includes("duplicate key")) {
      return { error: error.message || "Could not create company. Please try again." };
    }
  }
  if (!companyId) {
    return { error: "Could not generate a unique web address. Try a different name." };
  }

  // 1b. Brand: colours + optional logo upload. Stored in companies.settings.brand.
  const brand: Record<string, string> = {};
  if (parsed.data.brandPrimary) brand.primary = parsed.data.brandPrimary;
  if (parsed.data.brandSecondary) brand.secondary = parsed.data.brandSecondary;
  if (parsed.data.brandAccent) brand.accent = parsed.data.brandAccent;

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024) {
      return { error: "Logo must be under 2MB." };
    }
    const ext = (logo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${companyId}/logo.${ext || "png"}`;
    // Use the service-role client so the upload bypasses storage RLS (no
    // storage.objects policies needed). Public read works via the public bucket.
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("company-logos")
      .upload(path, logo, { upsert: true, contentType: logo.type || undefined });
    if (uploadError) {
      return { error: `Company created, but the logo upload failed: ${uploadError.message}` };
    }
    const { data: pub } = admin.storage.from("company-logos").getPublicUrl(path);
    if (pub?.publicUrl) brand.logo_url = pub.publicUrl;
  }

  // Persist branding, the sold plan/offer, the admin's details, and comp the
  // subscription up-front for Diamond (so the pay gate is skipped).
  {
    const { data: companyRow } = await supabase
      .from("companies").select("settings").eq("id", companyId).single();
    const settings: Record<string, unknown> = {
      ...((companyRow?.settings as Record<string, unknown>) ?? {}),
      // Explicit false puts this company in the "founder is finishing setup"
      // holding stage until the founder presses "Mark setup complete". Legacy
      // companies (no key) are never gated.
      setup_complete: false,
      pending_admin: {
        name: parsed.data.adminName,
        job_role: parsed.data.adminRole ?? null,
        phone: parsed.data.adminPhone ?? null,
      },
    };
    if (Object.keys(brand).length > 0) settings.brand = brand;
    const update: Record<string, unknown> = {
      settings,
      agreed_plan: parsed.data.plan,
      agreed_offer: agreedOffer || null,
    };
    if (parsed.data.plan === "diamond") update.billing_comped = true;
    await supabase.from("companies").update(update).eq("id", companyId);
  }

  // 1c. Seed the full starter pack so the company is turnkey on day one
  //     (same content as the prospect-Won path). Best-effort — never block the
  //     invite; the founder can re-apply from the company's setup page.
  try {
    await seedCompanyStarter(companyId);
  } catch {
    /* seeding is best-effort */
  }

  // 2. Invite the first admin for that company.
  const { data: invite, error: inviteError } = await supabase.rpc(
    "create_invitation",
    {
      p_company_id: companyId,
      p_email: parsed.data.adminEmail,
      p_role: "admin",
    }
  );

  revalidatePath("/founder");

  if (inviteError) {
    // Company was created; only the invite failed. Tell the founder so they can
    // re-send from the company's card.
    return {
      error: `Company created, but the admin invite failed: ${inviteError.message}. Use "Invite an administrator" on the company below.`,
    };
  }

  // Welcome email: greet them and send them to set up their subscription. The
  // button logs them in straight into the billing-only gate (agreement → pay).
  // Full access comes later, in the "account ready" email you fire once setup's
  // complete. Best-effort — never fail company creation on an email hiccup.
  const setupUrl = await acceptUrl(invite.token);
  const firstName = parsed.data.adminName.split(" ")[0] || "there";
  try {
    await sendBrandedEmail(createAdminClient(), null, {
      to: parsed.data.adminEmail,
      subject: "Welcome to Join Care Now — set up your subscription",
      text:
        `Hi ${firstName},\n\n` +
        `Welcome to Join Care Now! We're getting ${parsed.data.name}'s account ready for you.\n\n` +
        `To get started, use the button below to set up your subscription. Once that's done we'll ` +
        `finish configuring your account and email you the moment it's ready to use.\n\n` +
        `Welcome aboard,\nThe Join Care Now team`,
      cta: { label: "Set up your subscription", url: setupUrl },
    });
  } catch {
    /* email best-effort */
  }

  return {
    inviteLink: setupUrl,
    invitedEmail: parsed.data.adminEmail,
  };
}

/** Founder: "Mark setup complete & email them" — fires the phase-2 "account
 *  ready" email (with the login button) once the founder has finished setting
 *  the company up. Idempotent-ish: records when it was last sent. */
export async function sendAccountReadyEmail(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  await requirePlatformAdmin();
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string" || !companyId) return { error: "Missing company." };
  const db = createAdminClient();

  const { data: company } = await db
    .from("companies")
    .select("name, settings")
    .eq("id", companyId)
    .single();
  if (!company) return { error: "Company not found." };

  // Prefer the pending admin invitation (gives a set-password link); fall back
  // to a plain sign-in link if they've already accepted.
  const { data: invite } = await db
    .from("invitations")
    .select("token, email, status")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let to = (invite as { email?: string } | null)?.email ?? null;
  let url = "https://www.joincarenow.com/sign-in";
  if (invite && (invite as { status?: string }).status === "pending") {
    url = `https://www.joincarenow.com/accept-invite?token=${(invite as { token: string }).token}`;
  }
  if (!to) {
    // No invitation row — look up an admin member's email.
    const { data: admins } = await db
      .from("company_users")
      .select("profiles(email)")
      .eq("company_id", companyId)
      .eq("role", "admin")
      .limit(1);
    to = (admins?.[0] as { profiles?: { email?: string } } | undefined)?.profiles?.email ?? null;
  }
  if (!to) return { error: "No admin email on file for this company." };

  const res = await sendBrandedEmail(db, companyId, {
    to,
    subject: "Your Join Care Now account is ready",
    text:
      `Hi there,\n\n` +
      `Great news — ${(company as { name: string }).name}'s account on Join Care Now is all set up and ready for you.\n\n` +
      `Use the button below to set your password and log in. Everything's been pre-configured, so you can get started straight away.\n\n` +
      `Welcome aboard,\nThe Join Care Now team`,
    cta: { label: "Set up your account", url },
  });
  if (!res.ok) return { error: res.error || "Could not send the email." };

  const settings = {
    ...((company as { settings?: Record<string, unknown> }).settings ?? {}),
    setup_complete: true,
    ready_email_sent_at: new Date().toISOString(),
  };
  await db.from("companies").update({ settings }).eq("id", companyId);
  revalidatePath(`/founder/companies/${companyId}`);
  return { ok: true };
}

// ---------- Company profile: interview address ----------

export type SettingsState = { error?: string; ok?: boolean } | undefined;

/** Admins set the default in-person interview address for their company.
 *  Stored in companies.settings.interview_address. RLS limits this to admins. */
export async function setInterviewAddress(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const address = (formData.get("interviewAddress")?.toString() ?? "").slice(0, 500);

  const { db: supabase, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    interview_address: address,
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings })
    .eq("id", companyId);

  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Admins edit their public careers-page copy: an intro/about blurb and a
 *  list of benefits. Stored in companies.settings.careers. */
export async function setCareersContent(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const intro = (formData.get("intro")?.toString() ?? "").slice(0, 2000);
  const benefits = (formData.get("benefits")?.toString() ?? "")
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean)
    .slice(0, 12);

  const { db: supabase, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { data: company } = await supabase
    .from("companies").select("settings").eq("id", companyId).single();
  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    careers: { intro, benefits },
  };
  const { error } = await supabase.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Admins choose whether to show the left sidebar (off = iPad-style launcher). */
export async function setShowSidebar(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const companyId = formData.get("companyId");
  if (typeof companyId !== "string") return { error: "Missing company" };
  const show = formData.get("showSidebar") === "on";

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies").select("settings").eq("id", companyId).single();
  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    show_sidebar: show,
  };
  const { error } = await supabase.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { error: "Could not save. Please try again." };
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admins set the office opening hours (per ISO weekday). Interview times can
 *  then only be picked within these hours. */
export async function setOpeningHours(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const hours: Record<string, { open: string; close: string } | null> = {};
  for (let d = 1; d <= 7; d++) {
    const open = formData.get(`open_${d}`) === "on";
    const from = formData.get(`from_${d}`)?.toString() || "";
    const to = formData.get(`to_${d}`)?.toString() || "";
    if (open && from && to && from < to) {
      hours[String(d)] = { open: from, close: to };
    } else {
      hours[String(d)] = null;
    }
  }

  const { db: supabase, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    opening_hours: hours,
  };

  const { error } = await supabase.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  revalidatePath("/pipeline");
  return { ok: true };
}

/** Admins control automated reminders (interview, missing-doc, onboarding,
 *  start-date): on/off and channel per reminder. Stored in settings.reminders. */
export async function setReminderSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const kinds = ["interview", "docs", "onboarding", "start_date"] as const;
  const clamp = (raw: string | undefined, def: number, min: number, max: number): number => {
    const n = parseInt(raw ?? "", 10);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };
  const reminders: Record<string, Record<string, unknown>> = {};
  for (const k of kinds) {
    const ch = formData.get(`${k}_channel`)?.toString() ?? "both";
    const base = {
      enabled: formData.get(`${k}_enabled`) === "on",
      channel: ["email", "sms", "both"].includes(ch) ? ch : "both",
    };
    const num = (field: string) => formData.get(`${k}_${field}`)?.toString();
    if (k === "interview") {
      reminders[k] = { ...base, hoursBefore: clamp(num("hoursBefore"), 24, 1, 72) };
    } else if (k === "docs") {
      reminders[k] = {
        ...base,
        afterDays: clamp(num("afterDays"), 3, 1, 30),
        repeatDays: clamp(num("repeatDays"), 3, 1, 30),
      };
    } else if (k === "onboarding") {
      reminders[k] = { ...base, daysBefore: clamp(num("daysBefore"), 2, 1, 14) };
    } else {
      reminders[k] = { ...base, daysBefore: clamp(num("daysBefore"), 1, 1, 14) };
    }
  }

  const { db: supabase, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    reminders,
  };

  const { error } = await supabase.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Admins choose how Employee IDs are assigned: auto-generated with a prefix,
 *  or entered manually (for companies with their own payroll numbers). */
export async function setEmployeeNumberSettings(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const mode = formData.get("mode") === "manual" ? "manual" : "auto";
  let prefix = (formData.get("prefix")?.toString() ?? "").trim().slice(0, 20);
  if (mode === "auto" && !prefix) prefix = "EMP-";

  const { db: supabase, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };
  const { data: company } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .single();

  const settings = {
    ...((company?.settings as Record<string, unknown>) ?? {}),
    employee_number_mode: mode,
    employee_number_prefix: prefix,
  };

  const { error } = await supabase
    .from("companies")
    .update({ settings })
    .eq("id", companyId);

  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/settings");
  return { ok: true };
}

/** Set a company's branding — 3 colours + optional logo. Founder (via Quick
 *  setup) or a company admin. Stored in companies.settings.brand; logo goes to
 *  the public company-logos bucket. */
export async function setBranding(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { db, companyId } = await settingsContext(formData);
  if (!companyId) return { error: "Missing company" };

  const hex = (v: FormDataEntryValue | null) => {
    const s = (v?.toString() ?? "").trim();
    return HEX.test(s) ? s : "";
  };
  const primary = hex(formData.get("brandPrimary"));
  const secondary = hex(formData.get("brandSecondary"));
  const accent = hex(formData.get("brandAccent"));

  const { data: companyRow } = await db
    .from("companies").select("settings").eq("id", companyId).single();
  const existing = ((companyRow?.settings as Record<string, unknown>)?.brand as Record<string, string>) ?? {};
  const brand: Record<string, string> = { ...existing };
  brand.primary = primary || existing.primary || "";
  brand.secondary = secondary || existing.secondary || "";
  brand.accent = accent || existing.accent || "";

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024) return { error: "Logo must be under 2MB." };
    const ext = (logo.name.split(".").pop() ?? "png").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${companyId}/logo.${ext || "png"}`;
    const admin = createAdminClient();
    const { error: uploadError } = await admin.storage
      .from("company-logos")
      .upload(path, logo, { upsert: true, contentType: logo.type || undefined });
    if (uploadError) return { error: `Logo upload failed: ${uploadError.message}` };
    const { data: pub } = admin.storage.from("company-logos").getPublicUrl(path);
    if (pub?.publicUrl) brand.logo_url = `${pub.publicUrl}?v=${Date.now()}`;
  }

  const settings = {
    ...((companyRow?.settings as Record<string, unknown>) ?? {}),
    brand,
  };
  const { error } = await db.from("companies").update({ settings }).eq("id", companyId);
  if (error) return { error: "Could not save branding. Please try again." };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Founder-only: permanently delete a company and all its data. Requires the
 *  exact company name typed as confirmation. */
export async function deleteCompany(
  _prev: SettingsState,
  formData: FormData
): Promise<SettingsState> {
  const { profile } = await requireUser();
  if (!profile?.is_platform_admin) return { error: "Not allowed" };

  const id = formData.get("companyId")?.toString();
  const confirmName = (formData.get("confirmName")?.toString() ?? "").trim();
  if (!id) return { error: "Missing company" };

  const db = createAdminClient();
  const { data: company } = await db.from("companies").select("name").eq("id", id).single();
  if (!company) return { error: "Company not found" };
  if (confirmName !== (company.name as string)) {
    return { error: "The name you typed doesn't match." };
  }

  const { error } = await db.from("companies").delete().eq("id", id);
  if (error) return { error: "Could not delete the company." };

  revalidatePath("/founder/companies");
  revalidatePath("/founder");
  return { ok: true };
}
