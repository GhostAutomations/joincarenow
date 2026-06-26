"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { feedbackOpen } from "@/lib/feedback";

export type FeedbackState = { error?: string; ok?: boolean } | undefined;

/** Any company member can give feedback during the 4-week window. */
export async function submitFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const { supabase, user, current } = await requireCompany();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (body.length < 3) return { error: "Please write a little more." };

  const { data: company } = await supabase
    .from("companies").select("created_at").eq("id", current.company_id).single();
  if (!feedbackOpen(company?.created_at as string | undefined)) {
    return { error: "The feedback window has now closed." };
  }

  const { error } = await supabase
    .from("feedback")
    .insert({ company_id: current.company_id, author_id: user.id, body });
  if (error) return { error: "Could not submit your feedback. Please try again." };

  revalidatePath("/feedback");
  return { ok: true };
}

/** Founder responds to a piece of feedback. */
export async function respondFeedback(_prev: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const { profile } = await requireUser();
  if (!profile?.is_platform_admin) return { error: "Not allowed" };
  const id = formData.get("id")?.toString();
  const response = (formData.get("response")?.toString() ?? "").trim();
  if (!id) return { error: "Missing feedback" };
  if (response.length < 1) return { error: "Write a response first." };

  const db = createAdminClient();
  const { error } = await db
    .from("feedback")
    .update({ response, responded_by: profile.id, responded_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: "Could not save the response." };

  revalidatePath("/founder/feedback");
  return { ok: true };
}
