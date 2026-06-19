import { notFound, redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { DocEditorForm } from "@/components/dashboard/doc-editor-form";

// Contract/policy generation calls the LLM and can take a while — give the
// server action room (Vercel default would cut it off mid-generation).
export const maxDuration = 60;

const TABLE = {
  contract: "contract_templates",
  policy: "policy_documents",
} as const;

export default async function DocEditorPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "contract" && kind !== "policy") notFound();

  const { supabase, current } = await requireCompany();
  if (current.role !== "admin") redirect("/settings");

  let doc: { id: string; name: string; body: string; signatureMethod: "type" | "draw" } | null = null;
  if (id !== "new") {
    const { data } = await supabase
      .from(TABLE[kind])
      .select("id, name, body, signature_method")
      .eq("id", id)
      .eq("company_id", current.company_id)
      .maybeSingle();
    if (!data) notFound();
    doc = {
      id: data.id as string,
      name: data.name as string,
      body: (data.body as string) ?? "",
      signatureMethod: data.signature_method === "draw" ? "draw" : "type",
    };
  }

  // key per document so the form (incl. the signature-method selector) resets to
  // this doc's values instead of reusing the previous editor's state.
  return <DocEditorForm key={`${kind}-${id}`} kind={kind} doc={doc} />;
}
