import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrandedEmail } from "@/lib/comms/branded";

// ============================================================
// Error alerting — email the platform admin a digest of new errors.
// Reads error_logs rows that haven't been alerted yet, emails a grouped summary
// with a link to the founder error console, then stamps them alerted so they are
// never re-sent. Recipient: ERROR_ALERT_EMAIL if set, else the platform admin's
// own email. Best-effort — if email isn't configured/sends fail, rows are left
// unstamped so they alert once a recipient exists (they still show in the console).
// ============================================================

const CONSOLE_URL = "https://www.joincarenow.com/founder/errors";
const MAX_IN_DIGEST = 50;

type ErrRow = {
  id: string;
  source: string;
  code: string | null;
  message: string;
  company_id: string | null;
  created_at: string;
};

export type ErrorAlertRun = { newErrors: number; emailed: boolean; recipient: boolean };

export async function runErrorAlerts(): Promise<ErrorAlertRun> {
  const db = createAdminClient();

  const { data } = await db
    .from("error_logs")
    .select("id, source, code, message, company_id, created_at")
    .is("alerted_at", null)
    .neq("source", "api/cron/error-alerts") // never alert on the alerter's own failures
    .order("created_at", { ascending: true })
    .limit(MAX_IN_DIGEST + 1);
  const rows = (data ?? []) as ErrRow[];
  if (rows.length === 0) return { newErrors: 0, emailed: false, recipient: true };

  // Recipient: env override, else the platform admin's email.
  let to = (process.env.ERROR_ALERT_EMAIL ?? "").trim();
  if (!to) {
    const { data: admin } = await db
      .from("profiles")
      .select("email")
      .eq("is_platform_admin", true)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    to = ((admin?.email as string) ?? "").trim();
  }
  if (!to) return { newErrors: rows.length, emailed: false, recipient: false };

  const capped = rows.slice(0, MAX_IN_DIGEST);

  // Group identical errors (same source + message) so a burst reads as one line.
  const groups = new Map<string, { source: string; message: string; code: string | null; count: number }>();
  for (const e of capped) {
    const key = `${e.source}|${e.message}`;
    const g = groups.get(key) ?? { source: e.source, message: e.message, code: e.code, count: 0 };
    g.count += 1;
    groups.set(key, g);
  }
  const lines = [...groups.values()].map(
    (g) => `- [${g.source}]${g.code ? ` (${g.code})` : ""} ${g.message}${g.count > 1 ? `  x${g.count}` : ""}`
  );
  const overflow = rows.length > MAX_IN_DIGEST ? `\n\nand ${rows.length - MAX_IN_DIGEST} more new error(s) not shown.` : "";

  const subject = `Join Care Now: ${capped.length} new error${capped.length === 1 ? "" : "s"} logged`;
  const body =
    `New errors have been logged on the platform:\n\n${lines.join("\n")}${overflow}\n\n` +
    `Open the error console for full detail (stack traces, company, timestamps).`;

  const r = await sendBrandedEmail(db, null, {
    to,
    subject,
    text: body,
    cta: { label: "Open error console", url: CONSOLE_URL },
  });

  // Only stamp as alerted on a successful send, so a transient email failure
  // doesn't silently drop the alert.
  if (r.ok) {
    await db.from("error_logs").update({ alerted_at: new Date().toISOString() }).in("id", capped.map((e) => e.id));
  }

  return { newErrors: capped.length, emailed: r.ok, recipient: true };
}
