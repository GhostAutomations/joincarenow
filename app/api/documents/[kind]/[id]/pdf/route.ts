import { NextRequest } from "next/server";
import { requireCompany } from "@/modules/auth/queries";
import { buildDocumentPdf } from "@/lib/pdf/document-pdf";
import { fillDocument, readDocDefaults, deriveDocumentDetails } from "@/lib/documents/fill";

export const runtime = "nodejs";

const TABLES: Record<string, string> = {
  contract: "contract_templates",
  policy: "policy_documents",
  job_description: "job_descriptions",
};

/** Fetch the company's own logo (public URL) as bytes for embedding. */
async function loadLogo(url: string | null): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "").toLowerCase();
    const isPng = ct.includes("png") || /\.png(\?|$)/i.test(url);
    const bytes = new Uint8Array(await res.arrayBuffer());
    return { bytes, kind: isPng ? "png" : "jpg" };
  } catch {
    return null;
  }
}

/** Download a contract / policy / job-description template as a branded PDF —
 *  the company's logo + colours, cleaner typography, and its Document details
 *  (owner, HR contact, dates) merged in so nothing is left as a placeholder.
 *  Admin-only. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> }
) {
  const { kind, id } = await params;
  const table = TABLES[kind];
  if (!table) return new Response("Not found", { status: 404 });

  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") return new Response("Not allowed", { status: 403 });

  const [{ data: doc }, { data: company }] = await Promise.all([
    supabase.from(table).select("name, body, updated_at, created_at").eq("id", id).eq("company_id", current.company_id).maybeSingle(),
    supabase.from("companies").select("name, settings").eq("id", current.company_id).maybeSingle(),
  ]);
  if (!doc) return new Response("Not found", { status: 404 });

  const companyName = (company?.name as string) ?? "";
  const settings = company?.settings as { brand?: { logo_url?: string; primary?: string } } | null;
  // Dates derive from when the document was last saved (created/edited).
  const lastSaved = (doc.updated_at as string) ?? (doc.created_at as string) ?? new Date().toISOString();
  const details = deriveDocumentDetails(readDocDefaults(company?.settings), lastSaved);

  const body = fillDocument((doc.body as string) ?? "", { companyName, details });
  const logo = await loadLogo(settings?.brand?.logo_url ?? null);
  const generated = `Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${companyName ? ` · ${companyName}` : ""}`;

  const pdf = await buildDocumentPdf({
    title: (doc.name as string) ?? "Document",
    body,
    companyName,
    brandHex: settings?.brand?.primary,
    logo,
    footerMeta: generated,
  });

  const safe = ((doc.name as string) ?? "document").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
