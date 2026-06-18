"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";
import { createClient } from "@/lib/supabase/server";
import { notifyApplicant } from "@/modules/comms/actions";

const BASE_URL = "https://www.joincarenow.com";

export type OfferInfo = {
  id: string;
  role: string | null;
  startDate: string | null;
  pay: string | null;
  hours: string | null;
  conditional: boolean;
  conditions: string | null;
  message: string | null;
  status: string;
  sentAt: string | null;
  respondedAt: string | null;
  declineReason: string | null;
};

/** Latest offer for an application (for the pipeline panel). */
export async function getOffer(applicationId: string): Promise<OfferInfo | null> {
  const { supabase, current } = await requireCompany();
  const { data } = await supabase
    .from("offers")
    .select("id, role, start_date, pay, hours, conditional, conditions, message, status, sent_at, responded_at, decline_reason")
    .eq("application_id", applicationId)
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    role: (data.role as string) ?? null,
    startDate: (data.start_date as string) ?? null,
    pay: (data.pay as string) ?? null,
    hours: (data.hours as string) ?? null,
    conditional: !!data.conditional,
    conditions: (data.conditions as string) ?? null,
    message: (data.message as string) ?? null,
    status: data.status as string,
    sentAt: (data.sent_at as string) ?? null,
    respondedAt: (data.responded_at as string) ?? null,
    declineReason: (data.decline_reason as string) ?? null,
  };
}

/** Create + send an offer. Emails the applicant a secure accept/decline link and
 *  logs it to their Conversation. */
export async function sendOffer(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const applicationId = formData.get("applicationId")?.toString();
  const role = formData.get("role")?.toString().trim() || null;
  const startDate = formData.get("startDate")?.toString() || null;
  const pay = formData.get("pay")?.toString().trim() || null;
  const hours = formData.get("hours")?.toString().trim() || null;
  const conditional = formData.get("conditional") === "on";
  const conditions = formData.get("conditions")?.toString().trim() || null;
  const message = formData.get("message")?.toString().trim() || null;
  if (!applicationId) return { error: "Missing application" };

  const { supabase, user, current } = await requireCompany();

  const { data: app } = await supabase
    .from("applications")
    .select("applicant_id")
    .eq("id", applicationId)
    .eq("company_id", current.company_id)
    .single();
  if (!app?.applicant_id) return { error: "Application not found" };

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      company_id: current.company_id,
      application_id: applicationId,
      applicant_id: app.applicant_id,
      role,
      start_date: startDate,
      pay,
      hours,
      conditional,
      conditions,
      message,
      status: "sent",
      created_by: user.id,
    })
    .select("id, token")
    .single();
  if (error || !offer) return { error: "Could not create the offer. Please try again." };

  // Email the applicant via the shared notify path (builds merge context + logs
  // to Conversation), with merge tokens for name/company/role.
  const link = `${BASE_URL}/offer/${offer.token}`;
  const body = [
    "Hi {{first_name}},",
    "",
    `{{company_name}} is delighted to offer you the ${role || "{{job_title}}"}${
      conditional ? " (conditional offer)" : ""
    }.`,
    startDate ? `Start date: ${new Date(startDate).toLocaleDateString("en-GB")}` : "",
    pay ? `Pay: ${pay}` : "",
    hours ? `Hours: ${hours}` : "",
    conditional && conditions ? `Conditions: ${conditions}` : "",
    message ? `\n${message}` : "",
    "",
    "Please review and accept or decline your offer here:",
    link,
    "",
    "You can also accept or decline in your applicant portal.",
    "",
    "Thank you,",
    "{{company_name}}",
  ]
    .filter((l) => l !== "")
    .join("\n");

  await notifyApplicant({
    applicationId,
    channel: "email",
    subject: "Job offer from {{company_name}}",
    body,
  });

  revalidatePath("/pipeline");
  return { ok: true };
}

/** Public (applicant, no login): accept or decline an offer by token. On a
 *  decline the applicant may optionally give a reason and opt in to the talent pool. */
export async function respondToOffer(
  token: string,
  response: "accepted" | "declined",
  opts?: { reason?: string; talentPool?: boolean }
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_offer_by_token", {
    p_token: token,
    p_response: response,
    p_reason: opts?.reason ?? null,
    p_talent_pool: opts?.talentPool ?? false,
  });
  if (error) return { error: error.message || "Could not record your response." };
  return { ok: true };
}
