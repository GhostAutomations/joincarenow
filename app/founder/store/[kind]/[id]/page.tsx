import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { FounderDocBuild } from "@/components/dashboard/founder-doc-build";

// AI generation of a full contract/policy/JD can take a while — give the server
// action room (Vercel default would cut it off mid-generation).
export const maxDuration = 60;

const TABLE = {
  contract: "contract_templates",
  policy: "policy_documents",
  job_description: "job_descriptions",
} as const;

export default async function FounderDocBuildPage({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  if (kind !== "contract" && kind !== "policy" && kind !== "job_description") notFound();

  const { supabase } = await requirePlatformAdmin();

  const cols =
    kind === "job_description"
      ? "id, name, body, price_pence, store_category, store_published"
      : "id, name, body, price_pence, store_category, store_published, signature_method";
  const { data } = await supabase
    .from(TABLE[kind])
    .select(cols)
    .eq("id", id)
    .eq("is_store", true)
    .maybeSingle();
  if (!data) notFound();

  const row = data as unknown as {
    id: string;
    name: string;
    body: string | null;
    price_pence: number | null;
    store_category: string | null;
    store_published: boolean | null;
    signature_method?: string;
  };

  return (
    <FounderDocBuild
      kind={kind}
      doc={{
        id: row.id,
        name: row.name === `Untitled ${kind === "contract" ? "contract" : kind === "policy" ? "policy" : "job description"}` ? "" : row.name,
        body: row.body ?? "",
        signatureMethod:
          row.signature_method === "draw" ? "draw" : row.signature_method === "none" ? "none" : "type",
      }}
      category={row.store_category ?? ""}
      pricePence={row.price_pence ?? 0}
      published={row.store_published ?? false}
    />
  );
}
