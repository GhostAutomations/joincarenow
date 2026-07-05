import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocumentPdf } from "@/lib/pdf/document-pdf";

// ============================================================
// File signed contracts/policies into an employee's Documents
// ------------------------------------------------------------
// When an applicant is hired (and whenever a signed document is staff-approved
// after hire), we render each approved signature snapshot to a sealed PDF (the
// exact text agreed + the signature + an audit trail) and store it permanently
// in the employee's Documents (hr-documents bucket + employee_documents row).
//
// Idempotent: the storage path is deterministic per signed document, so re-runs
// overwrite the file rather than duplicating it, and the employee_documents row
// is only inserted once. Only staff-approved signatures are filed, so a "sealed"
// document is one that has passed the sign-off queue. Never throws to the caller
// (filing must not block a hire).
// ============================================================

type Db = SupabaseClient;

async function loadLogo(url: string | null): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const isPng = ct.includes("png") || /\.png(\?|$)/i.test(url);
    return { bytes: new Uint8Array(await res.arrayBuffer()), kind: isPng ? "png" : "jpg" };
  } catch {
    return null;
  }
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export type FileSignedDocsResult = { filed: number; skipped: number; failed: number };

export async function fileSignedDocumentsForEmployee(
  supabase: Db,
  opts: { companyId: string; employeeId: string; applicationId: string | null; createdBy?: string | null }
): Promise<FileSignedDocsResult> {
  const result: FileSignedDocsResult = { filed: 0, skipped: 0, failed: 0 };
  if (!opts.applicationId) return result;

  // Only staff-approved signatures are sealed into the employee file.
  const { data: docs } = await supabase
    .from("signed_documents")
    .select(
      "id, title, doc_type, body_snapshot, version, signer_name, signed_at, signer_ip, signature_method, signature_image"
    )
    .eq("company_id", opts.companyId)
    .eq("application_id", opts.applicationId)
    .eq("review_status", "approved");
  if (!docs || docs.length === 0) return result;

  // Existing filed paths for this employee (dedupe the employee_documents row).
  const { data: existing } = await supabase
    .from("employee_documents")
    .select("file_path")
    .eq("company_id", opts.companyId)
    .eq("employee_id", opts.employeeId);
  const existingPaths = new Set((existing ?? []).map((r) => r.file_path as string));

  // Company brand for the PDF header.
  const { data: company } = await supabase
    .from("companies")
    .select("name, settings")
    .eq("id", opts.companyId)
    .maybeSingle();
  const companyName = (company?.name as string) ?? "";
  const brand = ((company?.settings as { brand?: { logo_url?: string; primary?: string } } | null)?.brand) ?? {};
  const logo = await loadLogo(brand.logo_url ?? null);

  for (const d of docs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = d as any;
    const path = `${opts.companyId}/${opts.employeeId}/signed/${doc.id}.pdf`;
    try {
      const pdf = await buildDocumentPdf({
        title: doc.title ?? "Signed document",
        body: doc.body_snapshot ?? "",
        companyName,
        brandHex: brand.primary,
        logo,
        footerMeta: `Signed ${fmtDate(doc.signed_at)}${companyName ? ` · ${companyName}` : ""}`,
        signature: {
          signerName: doc.signer_name ?? "Signature",
          signedAt: doc.signed_at,
          signerIp: doc.signer_ip ?? null,
          method: doc.signature_method ?? "type",
          signatureImagePng: doc.signature_image ?? null,
          version: doc.version ?? null,
        },
      });

      const { error: upErr } = await supabase.storage
        .from("hr-documents")
        .upload(path, pdf, { contentType: "application/pdf", upsert: true });
      if (upErr) {
        result.failed += 1;
        continue;
      }

      if (existingPaths.has(path)) {
        // File refreshed in place; the Documents row already exists.
        result.skipped += 1;
        continue;
      }

      const label = doc.doc_type === "policy" ? "Policy" : "Contract";
      const { error: insErr } = await supabase.from("employee_documents").insert({
        company_id: opts.companyId,
        employee_id: opts.employeeId,
        doc_type: label,
        title: `${doc.title ?? "Signed document"} (signed)`,
        file_path: path,
        issued_date: typeof doc.signed_at === "string" ? doc.signed_at.slice(0, 10) : null,
        note: `Electronically signed by ${doc.signer_name ?? "the applicant"} on ${fmtDate(doc.signed_at)}`,
        created_by: opts.createdBy ?? null,
      });
      if (insErr) {
        result.failed += 1;
        continue;
      }
      result.filed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
