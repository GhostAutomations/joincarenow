import { createAdminClient } from "@/lib/supabase/admin";
import { renderMergeFields } from "@/lib/comms/send";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { sendCompanySms } from "@/lib/billing/usage";
import { isWithinSendingWindow } from "@/lib/prospects/send-window";

// Runs from the hourly cron (no user session) using the service-role client.
// RLS is bypassed, so every query is explicitly company-scoped via the joins.

export type ReminderChannel = "email" | "sms" | "both";
type ReminderCfg = {
  enabled: boolean;
  channel: ReminderChannel;
  hoursBefore?: number; // interview: lead time before the interview
  afterDays?: number;   // docs: start chasing once items are this many days old
  repeatDays?: number;  // docs: repeat the chaser every this many days
  daysBefore?: number;  // onboarding (task due) / start_date (first day)
};
type Db = ReturnType<typeof createAdminClient>;

export const REMINDER_KINDS = ["interview", "docs", "onboarding", "start_date"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];
const DEFAULT_CFG: ReminderCfg = { enabled: true, channel: "both" };
/** Default timing per reminder kind (used when a company hasn't customised it). */
const DEFAULT_TIMING: Record<ReminderKind, Partial<ReminderCfg>> = {
  interview: { hoursBefore: 24 },
  docs: { afterDays: 3, repeatDays: 3 },
  onboarding: { daysBefore: 2 },
  start_date: { daysBefore: 1 },
};

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

/** Quiet hours: only send automatic reminders between 08:00 and 20:00
 *  (Europe/London, DST-safe). The cron still runs hourly; outside this window it
 *  is a no-op so applicants aren't messaged late at night or early morning. */
const REMINDER_START_HOUR = 8;
const REMINDER_END_HOUR = 20;

export async function runReminders(): Promise<ReminderRun> {
  const db = createAdminClient();
  const result: ReminderRun = { sent: 0, skipped: 0, failed: 0, byKind: {} };

  // Outside 08:00–20:00 London time, do nothing.
  if (!isWithinSendingWindow(REMINDER_START_HOUR, REMINDER_END_HOUR)) return result;
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
    ...DEFAULT_TIMING[kind],
    ...(cfgMap.get(companyId)?.[kind] ?? {}),
  });

  const now = new Date();
  const iso = (d: Date) => d.toISOString();
  const dayStr = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const addHours = (d: Date, n: number) => new Date(d.getTime() + n * 3600e3);

  const appSelect =
    "applicants(first_name, last_name, email, phone), jobs(title), companies(name)";

  // 1) Interview reminder — confirmed interviews within each company's lead time
  //    (default 24h). Query a wide window, then fire only when the interview sits
  //    in the [hoursBefore, hoursBefore + 1) window for that company.
  {
    const MAX_H = 72;
    const { data } = await db
      .from("interviews")
      .select(`id, scheduled_at, application_id, applications(company_id, applicant_id, ${appSelect})`)
      .eq("status", "confirmed")
      .gte("scheduled_at", iso(now))
      .lt("scheduled_at", iso(addHours(now, MAX_H + 1)));
    for (const iv of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (iv as any).applications;
      if (!app) continue;
      const c = cfg(app.company_id, "interview");
      if (!c.enabled) continue;
      const hoursUntil = (new Date((iv as any).scheduled_at).getTime() - now.getTime()) / 3600e3;
      const H = c.hoursBefore ?? 24;
      if (hoursUntil < H || hoursUntil >= H + 1) continue;
      const ctx = ctxFromApp(app.company_id, (iv as any).application_id, app.applicant_id, app);
      const values = { ...ctx.values, interview_date: fmtDateTime((iv as any).scheduled_at) };
      tally("interview", await fire(db, ctx, "interview", c.channel, `interview:${(iv as any).id}:${(iv as any).scheduled_at}`, values));
    }
  }

  // 2) Missing-document chaser — required onboarding tasks the APPLICANT still
  //    has to action (pending or sent-back), older than the company's threshold
  //    (default 3 days), repeating on its interval (default every 3 days).
  //    Excludes submitted/approved tasks and hired / not-progressing applications.
  {
    const { data } = await db
      .from("onboarding_tasks")
      .select(`application_id, company_id, applicant_id, created_at, applications!inner(stage, ${appSelect})`)
      .in("status", ["pending", "rejected"])
      .eq("required", true)
      .lt("created_at", iso(addDays(now, -1)))
      .order("created_at", { ascending: true });
    const seen = new Set<string>();
    for (const t of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = t as any;
      if (seen.has(row.application_id)) continue;
      if (["hired", "rejected"].includes(row.applications?.stage)) continue;
      const c = cfg(row.company_id, "docs");
      if (!c.enabled) continue;
      const afterDays = c.afterDays ?? 3;
      // Oldest outstanding task must be at least afterDays old.
      if (new Date(row.created_at).getTime() > addDays(now, -afterDays).getTime()) continue;
      seen.add(row.application_id);
      const repeatDays = Math.max(1, c.repeatDays ?? 3);
      const bucket = Math.floor(now.getTime() / (repeatDays * 86400e3));
      const ctx = ctxFromApp(row.company_id, row.application_id, row.applicant_id, row.applications);
      tally("docs", await fire(db, ctx, "docs", c.channel, `docs:${row.application_id}:${bucket}`, ctx.values));
    }
  }

  // 3) Onboarding task nudge — incomplete tasks due within the company's window
  //    (default 2 days). One nudge per application per day.
  {
    const { data } = await db
      .from("onboarding_tasks")
      .select(`application_id, company_id, applicant_id, due_date, applications!inner(stage, ${appSelect})`)
      .in("status", ["pending", "rejected"])
      .gte("due_date", dayStr(now))
      .lte("due_date", dayStr(addDays(now, 14)))
      .order("due_date", { ascending: true });
    const seen = new Set<string>();
    for (const t of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = t as any;
      if (seen.has(row.application_id)) continue;
      if (["hired", "rejected"].includes(row.applications?.stage)) continue;
      const c = cfg(row.company_id, "onboarding");
      if (!c.enabled) continue;
      const daysBefore = c.daysBefore ?? 2;
      // Earliest due task must fall within the company's lead window.
      if (String(row.due_date) > dayStr(addDays(now, daysBefore))) continue;
      seen.add(row.application_id);
      const ctx = ctxFromApp(row.company_id, row.application_id, row.applicant_id, row.applications);
      tally("onboarding", await fire(db, ctx, "onboarding", c.channel, `onboarding:${row.application_id}:${dayStr(now)}`, ctx.values));
    }
  }

  // 4) Start-date reminder — new starters whose first day matches the company's
  //    lead (default 1 day before).
  {
    const { data } = await db
      .from("applications")
      .select(`id, company_id, applicant_id, start_date, ${appSelect}`)
      .gte("start_date", dayStr(addDays(now, 1)))
      .lte("start_date", dayStr(addDays(now, 14)));
    for (const a of data ?? []) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = a as any;
      const c = cfg(row.company_id, "start_date");
      if (!c.enabled) continue;
      const daysBefore = c.daysBefore ?? 1;
      if (String(row.start_date) !== dayStr(addDays(now, daysBefore))) continue;
      const ctx = ctxFromApp(row.company_id, row.id, row.applicant_id, row);
      const values = { ...ctx.values, start_date: fmtDate(row.start_date) };
      tally("start_date", await fire(db, ctx, "start_date", c.channel, `start_date:${row.id}:${row.start_date}`, values));
    }
  }

  return result;
}
