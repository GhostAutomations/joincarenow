"use server";

import { revalidatePath } from "next/cache";
import { requireApplicant } from "@/modules/auth/queries";

export type PortalReplyState = { error?: string; ok?: boolean } | undefined;

/** An applicant posts a reply in their portal conversation (in-app). */
export async function postApplicantReply(_prev: PortalReplyState, formData: FormData): Promise<PortalReplyState> {
  const applicationId = formData.get("applicationId")?.toString();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (!applicationId) return { error: "Missing conversation." };
  if (body.length < 1) return { error: "Write a message first." };

  const { supabase } = await requireApplicant(`/portal/conversations/${applicationId}`);

  // RLS (applications_select_own) ensures this application belongs to the user.
  const { data: app } = await supabase
    .from("applications")
    .select("id, company_id, applicant_id")
    .eq("id", applicationId)
    .maybeSingle();
  if (!app) return { error: "Conversation not found." };

  const { error } = await supabase.from("messages").insert({
    company_id: app.company_id,
    application_id: app.id,
    applicant_id: app.applicant_id,
    channel: "portal",
    direction: "inbound",
    body: body.slice(0, 5000),
    status: "delivered",
  });
  if (error) return { error: "Could not send your message." };

  revalidatePath(`/portal/conversations/${applicationId}`);
  revalidatePath("/portal/conversations");
  return { ok: true };
}
