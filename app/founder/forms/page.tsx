import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createBlankStoreForm } from "@/modules/forms/actions";
import { createBlankStoreDoc } from "@/modules/contracts/actions";
import { FounderStoreBrowser, type FounderStoreCard } from "@/components/dashboard/founder-store-browser";
import {
  FounderDocStoreBrowser,
  type FounderDocCard,
} from "@/components/dashboard/founder-doc-store-browser";

type StoreFormRow = {
  id: string;
  name: string;
  category: string | null;
  price_pence: number | null;
  store_published: boolean | null;
  form_fields: { count: number }[] | null;
};

type StoreDocRow = {
  id: string;
  name: string;
  store_category: string | null;
  price_pence: number | null;
  store_published: boolean | null;
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
const CREATE_LABEL: Record<string, string> = {
  contracts: "Create contract",
  policies: "Create policy",
  jobdescriptions: "Create job description",
};
const INTRO: Record<string, string> = {
  forms:
    "Templates you create here appear in every company's File Store. Free templates add instantly; priced ones are bought per form.",
  contracts:
    "Templates you create here appear in every company's File Store. Free templates add instantly; priced ones are bought per contract.",
  policies:
    "Templates you create here appear in every company's File Store. Free templates add instantly; priced ones are bought per policy.",
  jobdescriptions:
    "Templates you create here appear in every company's File Store. Free templates add instantly; priced ones are bought per job description.",
};

export default async function FounderFileStorePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabRaw } = await searchParams;
  const tab = TABS.some((t) => t.key === tabRaw) ? (tabRaw as string) : "forms";
  const { supabase } = await requirePlatformAdmin();

  let formCards: FounderStoreCard[] = [];
  let docCards: FounderDocCard[] = [];

  if (tab === "forms") {
    const { data } = await supabase
      .from("forms")
      .select("id, name, category, price_pence, store_published, form_fields(count)")
      .eq("is_store", true)
      .order("name", { ascending: true });
    formCards = ((data ?? []) as unknown as StoreFormRow[]).map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category || "other",
      price_pence: f.price_pence ?? 0,
      fieldCount: f.form_fields?.[0]?.count ?? 0,
      published: f.store_published ?? false,
    }));
  } else {
    const { data } = await supabase
      .from(DOC_TABLE[tab])
      .select("id, name, store_category, price_pence, store_published")
      .eq("is_store", true)
      .order("name", { ascending: true });
    docCards = ((data ?? []) as unknown as StoreDocRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      category: d.store_category || "general",
      price_pence: d.price_pence ?? 0,
      published: d.store_published ?? false,
    }));
  }

  const tabCls = (active: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-medium transition ${
      active
        ? "bg-white text-brand-700 shadow-sm"
        : "border border-white/40 bg-white/20 text-white/90 hover:bg-white/30"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">File Store</h1>
        {tab === "forms" ? (
          <form action={createBlankStoreForm}>
            <button className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700">
              <Plus className="h-5 w-5" aria-hidden /> Create form
            </button>
          </form>
        ) : (
          <form action={createBlankStoreDoc}>
            <input type="hidden" name="kind" value={DOC_KIND[tab]} />
            <button className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700">
              <Plus className="h-5 w-5" aria-hidden /> {CREATE_LABEL[tab]}
            </button>
          </form>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={`/founder/forms?tab=${t.key}`} className={tabCls(t.key === tab)}>
            {t.label}
          </Link>
        ))}
      </div>

      <p className="mt-4 text-sm text-white/80">{INTRO[tab]}</p>

      <div className="mt-6">
        {tab === "forms" ? (
          <FounderStoreBrowser forms={formCards} />
        ) : (
          <FounderDocStoreBrowser kind={DOC_KIND[tab]} docs={docCards} />
        )}
      </div>
    </div>
  );
}
