"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

export type RequestState = { error?: string; ok?: boolean } | undefined;

/** Company admins request a new feature. */
export async function submitRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const { supabase, user, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only company admins can request features." };

  const title = (formData.get("title")?.toString() ?? "").trim();
  const body = (formData.get("body")?.toString() ?? "").trim();
  if (title.length < 3) return { error: "Give your request a short title." };
  if (body.length < 5) return { error: "Describe what you'd like a bit more." };

  const { error } = await supabase
    .from("feature_requests")
    .insert({ company_id: current.company_id, author_id: user.id, title, body });
  if (error) return { error: "Could not submit your request. Please try again." };

  revalidatePath("/requests");
  return { ok: true };
}

/** Founder quotes a price for a feature request. */
export async function quoteRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const { profile } = await requireUser();
  if (!profile?.is_platform_admin) return { error: "Not allowed" };

  const id = formData.get("id")?.toString();
  const quoteAmount = (formData.get("quoteAmount")?.toString() ?? "").trim();
  const quoteNote = (formData.get("quoteNote")?.toString() ?? "").trim();
  if (!id) return { error: "Missing request" };
  if (quoteAmount.length < 1) return { error: "Enter a price." };

  const db = createAdminClient();
  const { error } = await db
    .from("feature_requests")
    .update({
      status: "quoted",
      quote_amount: quoteAmount,
      quote_note: quoteNote || null,
      quoted_by: profile.id,
      quoted_at: new Date().toISOString(),
      decided_at: null,
    })
    .eq("id", id);
  if (error) return { error: "Could not save the quote." };

  revalidatePath("/founder/requests");
  return { ok: true };
}

/** Company admin accepts or declines a quoted request. */
export async function decideRequest(_prev: RequestState, formData: FormData): Promise<RequestState> {
  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return { error: "Only company admins can do this." };

  const id = formData.get("id")?.toString();
  const decision = formData.get("decision")?.toString();
  if (!id || (decision !== "accepted" && decision !== "declined")) return { error: "Invalid decision" };

  const { error } = await supabase
    .from("feature_requests")
    .update({ status: decision, decided_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not update. Please try again." };

  revalidatePath("/requests");
  return { ok: true };
}
