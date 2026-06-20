"use server";

import { revalidatePath } from "next/cache";
import { requireCompany, requireApplicant } from "@/modules/auth/queries";
import { notifyApplicant } from "@/modules/comms/actions";

export type SignOffDoc = {
  id: string;
  applicationId: string | null;
  applicantName: string;
  title: string;
  docType: string; // contract | policy
  signerName: string;
  signedAt: string;
  signatureMethod: string; // type | draw
  signatureImage: string | null;
  body: string;
  version: number | null;
};

/** Signed contracts/policies still awaiting a staff sign-off, newest first. */
export async function getSignOffQueue(): Promise<SignOffDoc[]> {
  const { supabase, current } = await requireCompany();
  const { data } = await supabase
    .from("signed_documents")
    .select(
      "id, application_id, title, doc_type, signer_name, signed_at, signature_method, signature_image, body_snapshot, version, applicants(first_name, last_name)"
    )
    .eq("company_id", current.company_id)
    .eq("review_status", "pending")
    .order("signed_at", { ascending: true });

  return (data ?? []).map((d) => {
    const ap = d.applicants as unknown as { first_name: string | null; last_name: string | null } | null;
    return {
      id: d.id as string,
      applicationId: (d.application_id as string) ?? null,
      applicantName: [ap?.first_name, ap?.last_name].filter(Boolean).join(" ") || (d.signer_name as string),
      title: d.title as string,
      docType: d.doc_type as string,
      signerName: d.signer_name as string,
      signedAt: d.signed_at as string,
      signatureMethod: (d.signature_method as string) ?? "type",
      signatureImage: (d.signature_image as string) ?? null,
      body: d.body_snapshot as string,
      version: (d.version as number) ?? null,
    };
  });
}

/** Sign off (approve) a signed document — the signature has been checked. */
export async function signOffDocument(id: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, user, current } = await requireCompany();

  const { data: doc } = await supabase
    .from("signed_documents")
    .select("id, title, signer_name, review_status")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!doc) return { error: "Document not found" };
  if (doc.review_status !== "pending") return { ok: true };

  const { error } = await supabase
    .from("signed_documents")
    .update({ review_status: "approved", reviewed_by: user.id, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not sign off. Please try again." };

  await supabase.rpc("log_audit", {
    p_company_id: current.company_id,
    p_action: "document.signed_off",
    p_entity_type: "signed_document",
    p_entity_id: id,
    p_before: { review_status: "pending" },
    p_after: { review_status: "approved", title: doc.title, signer_name: doc.signer_name },
  });

  revalidatePath("/sign-off");
  revalidatePath("/dashboard");
  return { ok: true };
}

export type ResignDoc = {
  id: string;
  title: string;
  docType: string;
  body: string;
  signatureMethod: string;
  rejectReason: string | null;
};

/** Applicant re-signs a document staff rejected. Updates their own record in
 *  place with the new signature and puts it back into the sign-off queue. */
export async function resignDocument(
  id: string,
  signerName: string,
  signatureImage: string | null
): Promise<{ ok?: boolean; error?: string }> {
  const { supabase } = await requireApplicant();
  const name = signerName.trim();

  const { data: doc } = await supabase
    .from("signed_documents")
    .select("id, signature_method")
    .eq("id", id)
    .maybeSingle();
  if (!doc) return { error: "Document not found" };

  const drawn = doc.signature_method === "draw";
  if (drawn) {
    if (!signatureImage) return { error: "Please draw your signature." };
  } else if (name.length < 2) {
    return { error: "Please type your full name." };
  }

  const { error } = await supabase
    .from("signed_documents")
    .update({
      signer_name: drawn ? name || "Signature" : name,
      signature_image: drawn ? signatureImage : null,
      signed_at: new Date().toISOString(),
      review_status: "pending",
      reject_reason: null,
    })
    .eq("id", id);
  if (error) return { error: "Could not submit. Please try again." };

  revalidatePath("/portal");
  return { ok: true };
}

/** Reject a signature (e.g. illegible / not a real name) and ask the applicant
 *  to re-sign. Records the reason in the audit trail and notifies the applicant. */
export async function rejectDocument(
  id: string,
  reason: string
): Promise<{ ok?: boolean; error?: string }> {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return { error: "Add a short reason so the applicant knows what to fix." };

  const { supabase, user, current } = await requireCompany();

  const { data: doc } = await supabase
    .from("signed_documents")
    .select("id, title, signer_name, application_id, review_status")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!doc) return { error: "Document not found" };

  const { error } = await supabase
    .from("signed_documents")
    .update({
      review_status: "rejected",
      reject_reason: trimmed,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("company_id", current.company_id);
  if (error) return { error: "Could not reject. Please try again." };

  await supabase.rpc("log_audit", {
    p_company_id: current.company_id,
    p_action: "document.signoff_rejected",
    p_entity_type: "signed_document",
    p_entity_id: id,
    p_before: { review_status: doc.review_status },
    p_after: { review_status: "rejected", reason: trimmed, title: doc.title },
  });

  // Let the applicant know they need to sign again.
  if (doc.application_id) {
    await notifyApplicant({
      applicationId: doc.application_id as string,
      channel: "email",
      subject: `Please re-sign: ${doc.title}`,
      body: `Hi {{first_name}},\n\nWe need you to sign "${doc.title}" again. Reason: ${trimmed}\n\nPlease log in to your portal to re-sign:\nhttps://www.joincarenow.com/portal\n\nKind regards,\n{{company_name}}`,
    });
  }

  revalidatePath("/sign-off");
  revalidatePath("/dashboard");
  return { ok: true };
}
