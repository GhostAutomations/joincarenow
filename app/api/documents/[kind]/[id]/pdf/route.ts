import { NextRequest } from "next/server";
import { requireCompany } from "@/modules/auth/queries";
import { buildDocumentPdf, fillTemplateForDownload } from "@/lib/pdf/document-pdf";

const TABLES: Record<string, string> = {
  contract: "contract_templates",
  policy: "policy_documents",
  job_description: "job_descriptions",
};

/** Download a contract / policy / job-description template as a PDF, with its
 *  merge fields filled in (company details resolved, person/offer fields shown as
 *  clear placeholders so nothing is left as a raw {{token}}). Admin-only. */
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
    supabase.from(table).select("name, body").eq("id", id).eq("company_id", current.company_id).maybeSingle(),
    supabase.from("companies").select("name").eq("id", current.company_id).maybeSingle(),
  ]);
  if (!doc) return new Response("Not found", { status: 404 });

  const companyName = (company?.name as string) ?? "";
  const body = fillTemplateForDownload((doc.body as string) ?? "", { companyName });
  const generated = `Generated ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}${companyName ? ` · ${companyName}` : ""}`;
  const pdf = buildDocumentPdf((doc.name as string) ?? "Document", body, generated);

  const safe = ((doc.name as string) ?? "document").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${safe}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
