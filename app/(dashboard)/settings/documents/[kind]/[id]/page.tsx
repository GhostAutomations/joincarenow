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

  let doc: { id: string; name: string; body: string } | null = null;
  if (id !== "new") {
    const { data } = await supabase
      .from(TABLE[kind])
      .select("id, name, body")
      .eq("id", id)
      .eq("company_id", current.company_id)
      .maybeSingle();
    if (!data) notFound();
    doc = { id: data.id as string, name: data.name as string, body: (data.body as string) ?? "" };
  }

  return <DocEditorForm kind={kind} doc={doc} />;
}
