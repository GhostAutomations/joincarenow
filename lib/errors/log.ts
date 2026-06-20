import { createAdminClient } from "@/lib/supabase/admin";

/** Record an error to the platform error log. Best-effort: never throws, so it's
 *  safe to call from any catch block. */
export async function logError(e: {
  source: string;
  message: string;
  code?: string | null;
  detail?: unknown;
  companyId?: string | null;
}): Promise<void> {
  try {
    const db = createAdminClient();
    let detail: unknown = null;
    if (e.detail !== undefined && e.detail !== null) {
      try {
        detail = JSON.parse(JSON.stringify(e.detail));
      } catch {
        detail = { value: String(e.detail) };
      }
    }
    await db.from("error_logs").insert({
      source: e.source.slice(0, 200),
      message: (e.message || "Unknown error").slice(0, 4000),
      code: e.code ? String(e.code).slice(0, 100) : null,
      detail,
      company_id: e.companyId ?? null,
    });
  } catch {
    // Swallow — logging must never break the caller.
  }
}
