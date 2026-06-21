"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export type DemoLeadState = { ok?: boolean; error?: string } | undefined;

const SETTINGS = ["domiciliary", "residential", "supported_living", "other"] as const;

function clean(v: FormDataEntryValue | null, max = 200): string {
  return (v?.toString() ?? "").trim().slice(0, max);
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/**
 * Public "Book a demo" submission. Stores the lead straight into the founder
 * Sales pipeline as a new prospect (source = 'website'), so the existing AI
 * first-contact and auto-stage flow picks it up. No auth — uses the admin
 * client; inputs are validated and length-capped.
 */
export async function submitDemoLead(
  _prev: DemoLeadState,
  formData: FormData
): Promise<DemoLeadState> {
  // Honeypot: real users never fill this hidden field.
  if (clean(formData.get("company_website"))) return { ok: true };

  const name = clean(formData.get("name"));
  const company = clean(formData.get("company"));
  const role = clean(formData.get("role"), 80);
  const email = clean(formData.get("email"));
  const phone = clean(formData.get("phone"), 40);
  const settingRaw = clean(formData.get("setting"), 40);
  const setting = (SETTINGS as readonly string[]).includes(settingRaw) ? settingRaw : null;
  const consent = formData.get("consent") === "on";

  if (!name || !company) return { error: "Please add your name and company." };
  if (!isEmail(email)) return { error: "Please enter a valid email address." };
  if (!consent) return { error: "Please tick the consent box so we can contact you." };

  const db = createAdminClient();

  const { data: prospect, error } = await db
    .from("prospect_companies")
    .insert({
      name: company,
      setting_type: setting,
      source: "website",
      notes: `Demo request from the website${role ? ` — ${role}` : ""}.`,
    })
    .select("id")
    .single();
  if (error || !prospect) return { error: "Something went wrong. Please try again." };

  await db.from("prospect_contacts").insert({
    prospect_company_id: prospect.id,
    name,
    role: role || null,
    email,
    phone: phone || null,
    consent_basis: "Website demo request (consent given on joincarenow.com)",
  });

  await db.from("prospect_activities").insert({
    prospect_company_id: prospect.id,
    type: "system",
    body: `New demo request from the website — ${name}${role ? `, ${role}` : ""} at ${company}.`,
  });

  return { ok: true };
}
