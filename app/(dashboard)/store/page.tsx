import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { StoreBrowser, type StoreCard } from "@/components/dashboard/store-browser";
import { DocStoreBrowser, type DocStoreCard } from "@/components/dashboard/doc-store-browser";

type StoreForm = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price_pence: number | null;
  form_fields: { count: number }[] | null;
};

type StoreDocRow = {
  id: string;
  name: string;
  store_category: string | null;
  price_pence: number | null;
};

const TABS = [
  { key: "forms", label: "Forms" },
  { key: "contracts", label: "Contracts" },
  { key: "policies", label: "Policies" },
  { key: "jobdescriptions", label: "Job descriptions" },
] as const;

const DOC_TABLE: Record<string, string> = {
  contracts: "contract_templates",
  policies: "policy_documents",
  jobdescriptions: "job_descriptions",
};
const DOC_KIND: Record<string, "contract" | "policy" | "job_description"> = {
  contracts: "contract",
  policies: "policy",
  jobdescriptions: "job_description",
};
const SUBTITLE: Record<string, string> = {
  forms: "Ready-made forms. Preview, add to your Forms, or customise before adding.",
  contracts: "Ready-made contract templates. Preview, then add to your contracts & policies.",
  policies: "Ready-made policies. Preview, then add to your contracts & policies.",
  jobdescriptions: "Ready-made job descriptions. Add them, then pick them when creating a job.",
};

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { supabase, current } = await requireCompany();
  // File Store purchases affect billing — admin-only.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = true;

  const { tab: tabRaw } = await searchParams;
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as string) : "forms";

  const { data: company } = await supabase
    .from("companies")
    .select("billing_status, billing_comped, stripe_customer_id")
    .eq("id", current.company_id)
    .single();
  const comped = company?.billing_comped === true;
  const status = (company?.billing_status as string) ?? "none";
  const billingReady =
    comped || ((status === "active" || status === "trialing") && !!company?.stripe_customer_id);

  let formCards: StoreCard[] = [];
  let docCards: DocStoreCard[] = [];

  if (tab === "forms") {
    const [{ data: forms }, { data: mine }] = await Promise.all([
      supabase
        .from("forms")
        .select("id, name, description, category, price_pence, form_fields(count)")
        .eq("is_store", true)
        .eq("store_published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("forms")
        .select("source_form_id")
        .eq("company_id", current.company_id)
        .not("source_form_id", "is", null),
    ]);
    const acquired = new Set((mine ?? []).map((m) => m.source_form_id as string).filter(Boolean));
    formCards = ((forms ?? []) as unknown as StoreForm[]).map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      category: f.category,
      pricePence: f.price_pence ?? 0,
      fieldCount: f.form_fields?.[0]?.count ?? 0,
      acquired: acquired.has(f.id),
    }));
  } else {
    const table = DOC_TABLE[tab];
    const [{ data: rows }, { data: mine }] = await Promise.all([
      supabase
        .from(table)
        .select("id, name, store_category, price_pence")
        .eq("is_store", true)
        .eq("store_published", true)
        .order("name", { ascending: true }),
      supabase
        .from(table)
        .select("source_id")
        .eq("company_id", current.company_id)
        .not("source_id", "is", null),
    ]);
    const acquired = new Set((mine ?? []).map((m) => m.source_id as string).filter(Boolean));
    docCards = ((rows ?? []) as unknown as StoreDocRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.store_category || "general",
      pricePence: d.price_pence ?? 0,
      acquired: acquired.has(d.id),
    }));
  }

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition ${
      active
        ? "bg-white text-brand-700 shadow-sm"
        : "border border-white/40 bg-white/40 text-gray-700 hover:bg-white/70"
    }`;

  const empty = tab === "forms" ? formCards.length === 0 : docCards.length === 0;

  return (
    <div>
      <PageHeader title="File Store" subtitle={SUBTITLE[tab]} />

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/store?tab=${t.key}`} className={tabCls(t.key === tab)}>
            {t.label}
          </Link>
        ))}
      </div>

      <div className="mt-6">
        {empty ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            Nothing available here yet.
          </div>
        ) : tab === "forms" ? (
          <StoreBrowser forms={formCards} isAdmin={isAdmin} billingReady={billingReady} comped={comped} />
        ) : (
          <DocStoreBrowser
            kind={DOC_KIND[tab]}
            docs={docCards}
            isAdmin={isAdmin}
            billingReady={billingReady}
            comped={comped}
          />
        )}
      </div>
    </div>
  );
}
