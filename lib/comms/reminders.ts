import { createAdminClient } from "@/lib/supabase/admin";
import { renderMergeFields } from "@/lib/comms/send";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { sendCompanySms } from "@/lib/billing/usage";

// Runs from the hourly cron (no user session) using the service-role client.
// RLS is bypassed, so every query is explicitly company-scoped via the joins.

export type ReminderChannel = "email" | "sms" | "both";
type ReminderCfg = { enabled: boolean; channel: ReminderChannel };
type Db = ReturnType<typeof createAdminClient>;

export const REMINDER_KINDS = ["interview", "docs", "onboarding", "start_date"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
const DEFAULT_CFG: ReminderCfg = { enabled: true, channel: "both" };

const PORTAL = "https://www.joincarenow.com/portal";

const BODIES: Record<ReminderKind, { subject: string; body: string }> = {
  interview: {
    subject: "Reminder: your interview with {{company_name}}",
    body: "Hi {{first_name}},\n\nThis is a friendly reminder of your interview for the {{job_title}} role with {{company_name}} on {{interview_date}}.\n\nIf you can no longer attend, please let us know.\n\nKind regards,\n{{company_name}}",
  },
  docs: {
    subject: "A reminder to finish your application with {{company_name}}",
    body: "Hi {{first_name}},\n\nYou still have outstanding items to complete for your {{job_title}} application with {{company_name}}. Please log in to your portal to finish them:\n{{portal_link}}\n\nIf you've already done these, please ignore this message.\n\nKind regards,\n{{company_name}}",
  },
  onboarding: {
    subject: "Your onboarding tasks are due soon",
    body: "Hi {{first_name}},\n\nA quick reminder that you have onboarding tasks due soon for your role with {{company_name}}. Please complete them here:\n{{portal_link}}\n\nKind regards,\n{{company_name}}",
  },
  start_date: {
    subject: "Your first day at {{company_name}} is almost here",
    body: "Hi {{first_name}},\n\nWe're looking forward to welcoming you on {{start_date}} for your {{job_title}} role with {{company_name}}. If you have any questions before your first day, just reply to this message.\n\nKind regards,\n{{company_name}}",
  },
};

function normalizeUkPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZone: "Europe/London",
  });
}
function fmtDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London",
  });
}

type Ctx = {
  companyId: string;
  applicationId: string;
  applicantId: string;
  email: string | null;
  phone: string | null;
  values: Record<string, string>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ctxFromApp(companyId: string, applicationId: string, applicantId: string, app: any): Ctx {
  const ap = app?.applicants ?? {};
  return {
    companyId,
    applicationId,
    applicantId,
    email: ap.email ?? null,
    phone: ap.phone ?? null,
    values: {
      first_name: ap.first_name ?? "",
      last_name: ap.last_name ?? "",
      job_title: app?.jobs?.title ?? "",
      company_name: app?.companies?.name ?? "",
      portal_link: PORTAL,
    },
  };
}

async function logMessage(
  db: Db,
  ctx: Ctx,
  channel: "email" | "sms",
  to: string,
  subject: string | null,
  body: string,
  ok: boolean,
  providerId?: string,
  error?: string
) {
  await db.from("messages").insert({
    company_id: ctx.companyId,
    application_id: ctx.applicationId,
    applicant_id: ctx.applicantId,
    channel,
    direction: "outbound",
    to_address: to,
    subject,
    body,
    status: ok ? "sent" : "failed",
    provider_id: providerId ?? null,
    error: ok ? null : error ?? null,
    created_by: null,
  });
}

/** Send a reminder once (dedupe-guarded), via the configured channel(s), and
 *  log every send to the applicant's timeline. */
async function fire(
  db: Db,
  ctx: Ctx,
  kind: ReminderKind,
  channel: ReminderChannel,
  dedupeKey: string,
  values: Record<string, string>
): Promise<"sent" | "skipped" | "failed"> {
  const { data: existing } = await db
    .from("reminder_log")
    .select("id")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existing) return "skipped";

  const subject = renderMergeFields(BODIES[kind].subject, values);
  const body = renderMergeFields(BODIES[kind].body, values);

  const wantEmail = (channel === "email" || channel === "both") && !!ctx.email;
  const phoneN = normalizeUkPhone(ctx.phone);
  const wantSms = (channel === "sms" || channel === "both") && !!phoneN;
  if (!wantEmail && !wantSms) return "skipped";

  let anyOk = false;
  if (wantEmail) {
    const r = await sendBrandedEmail(db, ctx.companyId, { to: ctx.email!, subject: subject || "(no subject)", text: body });
    await logMessage(db, ctx, "email", ctx.email!, subject, body, r.ok, r.id, r.error);
    anyOk = anyOk || r.ok;
  }
  if (wantSms) {
    const r = await sendCompanySms(ctx.companyId, { to: phoneN!, body });
    await logMessage(db, ctx, "sms", phoneN!, null, body, r.ok, r.id, r.error);
    anyOk = anyOk || r.ok;
  }

  if (!anyOk) return "failed";
  await db.from("reminder_log").insert({ company_id: ctx.companyId, kind, dedupe_key: dedupeKey });
  return "sent";
}

export type ReminderRun = { sent: number; skipped: number; failed: number; byKind: Record<string, number> };

export async function runReminders(): Promise<ReminderRun> {
  const db = createAdminClient();
  const result: ReminderRun = { sent: 0, skipped: 0, failed: 0, byKind: {} };
  const tally = (kind: ReminderKind, r: "sent" | "skipped" | "failed") => {
    result[r] += 1;
    if (r === "sent") result.byKind[kind] = (result.byKind[kind] ?? 0) + 1;
  };

  // Per-company reminder config.
  const { data: companies } = await db.from("companies").select("id, settings");
  const cfgMap = new Map<string, Record<string, ReminderCfg>>();
  for (const c of companies ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cfgMap.set(c.id, ((c as any).settings?.reminders ?? {}) as Record<string, ReminderCfg>);
  }
  const cfg = (companyId: string, kind: ReminderKind): ReminderCfg => ({
    ...DEFAULT_CFG,
    ...(cfgMap.get(companyId)?.[kind] ?? {}),
  });

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const dayStr = (d: Date) => d.toISOString().slice(0, 10);
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const plus2 = new Date(now); plus2.setDate(now.getDate() + 2);
  const in24 = new Date(now.getTime() + 24 * 3600e3);
  const in25 = new Date(now.getTime() + 25 * 3600e3);
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400e3);
  const bucket = Math.floor(now.getTime() / (3 * 86400e3)); // ~3-day repeat window

  const appSelect =
    "applicants(first_name, last_name, email, phone), jobs(title), companies(name)";

  // 1) Interview reminder — confirmed interviews ~24h away.
  {
    const { data } = await db
      .from("interviews")
      .select(`id, scheduled_at, application_id, applications(company_id, applicant_id, ${appSelect})`)
      .eq("status", "confirmed")
      .gte("scheduled_at", iso(in24))
      .lt("scheduled_at", iso(in25));
    for (const iv of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (iv as any).applications;
      if (!app) continue;
      if (!cfg(app.company_id, "interview").enabled) continue;
      const ctx = ctxFromApp(app.company_id, (iv as any).application_id, app.applicant_id, app);
      const values = { ...ctx.values, interview_date: fmtDateTime((iv as any).scheduled_at) };
      tally("interview", await fire(db, ctx, "interview", cfg(app.company_id, "interview").channel, `interview:${(iv as any).id}:${(iv as any).scheduled_at}`, values));
    }
  }

  // 2) Missing-document chaser — incomplete required onboarding tasks older than
  //    3 days. One message per application, repeating ~every 3 days.
  {
    const { data } = await db
      .from("onboarding_tasks")
      .select(`application_id, company_id, applicant_id, applications!inner(${appSelect})`)
      .is("completed_at", null)
      .eq("required", true)
      .lt("created_at", iso(threeDaysAgo));
    const seen = new Set<string>();
    for (const t of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = t as any;
      if (seen.has(row.application_id)) continue;
      seen.add(row.application_id);
      if (!cfg(row.company_id, "docs").enabled) continue;
      const ctx = ctxFromApp(row.company_id, row.application_id, row.applicant_id, row.applications);
      tally("docs", await fire(db, ctx, "docs", cfg(row.company_id, "docs").channel, `docs:${row.application_id}:${bucket}`, ctx.values));
    }
  }

  // 3) Onboarding task nudge — incomplete tasks due within the next 2 days.
  //    One nudge per application per day.
  {
    const { data } = await db
      .from("onboarding_tasks")
      .select(`application_id, company_id, applicant_id, applications!inner(${appSelect})`)
      .is("completed_at", null)
      .neq("status", "approved")
      .gte("due_date", dayStr(now))
      .lte("due_date", dayStr(plus2));
    const seen = new Set<string>();
    for (const t of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = t as any;
      if (seen.has(row.application_id)) continue;
      seen.add(row.application_id);
      if (!cfg(row.company_id, "onboarding").enabled) continue;
      const ctx = ctxFromApp(row.company_id, row.application_id, row.applicant_id, row.applications);
      tally("onboarding", await fire(db, ctx, "onboarding", cfg(row.company_id, "onboarding").channel, `onboarding:${row.application_id}:${dayStr(now)}`, ctx.values));
    }
  }

  // 4) Start-date reminder — new starters whose first day is tomorrow.
  {
    const { data } = await db
      .from("applications")
      .select(`id, company_id, applicant_id, start_date, ${appSelect}`)
      .eq("start_date", dayStr(tomorrow));
    for (const a of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = a as any;
      if (!cfg(row.company_id, "start_date").enabled) continue;
      const ctx = ctxFromApp(row.company_id, row.id, row.applicant_id, row);
      const values = { ...ctx.values, start_date: fmtDate(row.start_date) };
      tally("start_date", await fire(db, ctx, "start_date", cfg(row.company_id, "start_date").channel, `start_date:${row.id}:${row.start_date}`, values));
    }
  }

  return result;
}
