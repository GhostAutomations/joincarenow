import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { DocEditorForm } from "@/components/dashboard/doc-editor-form";

// Contract/policy generation calls the LLM and can take a while — give the
// server action room (Vercel default would cut it off mid-generation).
export const maxDuration = 60;

const TABLE = {
  contract: "contract_templates",
  policy: "policy_documents",
  job_description: "job_descriptions",
} as const;

export default async function DocEditorPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "contract" && kind !== "policy" && kind !== "job_description") notFound();

  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") redirect("/settings");

  let doc: { id: string; name: string; body: string; signatureMethod: "type" | "draw" } | null = null;
  if (id !== "new") {
    // Job descriptions aren't signed, so they have no signature_method column.
    const cols = kind === "job_description" ? "id, name, body" : "id, name, body, signature_method";
    const { data } = await supabase
      .from(TABLE[kind])
      .select(cols)
      .eq("id", id)
      .eq("company_id", current.company_id)
      .maybeSingle();
    if (!data) notFound();
    const row = data as unknown as { id: string; name: string; body: string | null; signature_method?: string };
    doc = {
      id: row.id,
      name: row.name,
      body: row.body ?? "",
      signatureMethod: row.signature_method === "draw" ? "draw" : "type",
    };
  }

  // key per document so the form (incl. the signature-method selector) resets to
  // this doc's values instead of reusing the previous editor's state.
  return <DocEditorForm key={`${kind}-${id}`} kind={kind} doc={doc} />;
}
