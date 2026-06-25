import type { SupabaseClient } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";
import { sendBrandedEmail } from "@/lib/comms/branded";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Notify a job's owner about applicant activity — an in-app notification plus a
 * branded email. Resolves the owner from the application's job (owner_id,
 * falling back to the job's creator). Runs with the service-role admin client
 * (webhooks / public actions have no session). Best-effort: never throws.
 */
export async function notifyJobOwner(
  admin: Admin,
  opts: {
    applicationId: string;
    type: string; // notification type, e.g. 'new_application'
    prefKey: "new_application" | "applicant_message"; // which preference governs this
    title: string;
    body?: string | null;
    link: string; // in-app path to open
    email?: { subject: string; text: string; ctaLabel: string; ctaUrl: string };
  }
): Promise<void> {
  try {
    const { data: app } = await admin
      .from("applications")
      .select("job_id, company_id")
      .eq("id", opts.applicationId)
      .maybeSingle();
    const jobId = (app as { job_id?: string } | null)?.job_id;
    const companyId = (app as { company_id?: string } | null)?.company_id;
    if (!jobId || !companyId) return;

    const { data: job } = await admin
      .from("jobs")
      .select("owner_id, created_by")
      .eq("id", jobId)
      .maybeSingle();
    const ownerId =
      (job as { owner_id?: string | null; created_by?: string | null } | null)?.owner_id ??
      (job as { created_by?: string | null } | null)?.created_by ??
      null;
    if (!ownerId) return;

    // The owner's per-event channel preferences (absent = both on).
    const { data: prof } = await admin
      .from("profiles")
      .select("email, notification_prefs")
      .eq("id", ownerId)
      .maybeSingle();
    const prefs = (prof as { notification_prefs?: Record<string, { inApp?: boolean; email?: boolean }> | null } | null)
      ?.notification_prefs ?? null;
    const pref = prefs?.[opts.prefKey] ?? {};
    const wantInApp = pref.inApp ?? true;
    const wantEmail = pref.email ?? true;

    if (wantInApp) {
      await admin.from("notifications").insert({
        company_id: companyId,
        user_id: ownerId,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link,
      });
    }

    if (opts.email && wantEmail) {
      const to = (prof as { email?: string | null } | null)?.email;
      if (to) {
        await sendBrandedEmail(admin as unknown as SupabaseClient, null, {
          to,
          subject: opts.email.subject,
          text: opts.email.text,
          cta: { label: opts.email.ctaLabel, url: opts.email.ctaUrl },
        });
      }
    }
  } catch {
    /* best-effort — never block the caller */
  }
}
