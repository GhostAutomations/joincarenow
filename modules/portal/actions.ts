"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { requireApplicant } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyJobOwner } from "@/lib/comms/notify-owner";
import { handleRubyReply, isRubyConversing } from "@/lib/ruby/conversation";

/** Gap before Ruby replies, so the conversation feels human rather than instant. */
const RUBY_REPLY_DELAY_MS = 15_000;

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

  // If Ruby is mid-screening with this applicant, let Ruby handle the reply
  // (record the answer, ask the next question). Skip the human owner notification
  // in that case — the owner is alerted when the screening completes/declines.
  // Ruby's reply is posted after a short gap (via `after`, so this action still
  // returns immediately and the applicant's own message shows straight away) so
  // the conversation feels human rather than instant.
  const admin = createAdminClient();
  if (await isRubyConversing(admin, app.id)) {
    after(async () => {
      await new Promise((r) => setTimeout(r, RUBY_REPLY_DELAY_MS));
      await handleRubyReply(createAdminClient(), app.id, body);
    });
    revalidatePath(`/portal/conversations/${applicationId}`);
    revalidatePath("/portal/conversations");
    return { ok: true };
  }

  // Notify the job's owner of the applicant's reply (in-app + email).
  const { data: ap } = await supabase
    .from("applicants")
    .select("first_name, last_name")
    .eq("id", app.applicant_id)
    .maybeSingle();
  const name = [ap?.first_name, ap?.last_name].filter(Boolean).join(" ") || "An applicant";
  await notifyJobOwner(createAdminClient(), {
    applicationId: app.id,
    type: "portal_message",
    prefKey: "applicant_message",
    title: `New message from ${name}`,
    body: body.slice(0, 160),
    link: `/pipeline?open=${app.id}`,
    email: {
      subject: `${name} sent you a message`,
      text: `${name} has replied in their applicant portal on Join Care Now. Use the button below to read it and respond.`,
      ctaLabel: "View conversation",
      ctaUrl: `https://www.joincarenow.com/pipeline?open=${app.id}`,
    },
  });

  revalidatePath(`/portal/conversations/${applicationId}`);
  revalidatePath("/portal/conversations");
  return { ok: true };
}
