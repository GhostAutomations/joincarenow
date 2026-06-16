import { requireCompany } from "@/modules/auth/queries";
import { TIER_LABEL } from "@/modules/forms/tiers";
import { PageHeader } from "@/components/dashboard/page-header";
import { StoreBrowser, type StoreCard } from "@/components/dashboard/store-browser";

type StoreForm = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  store_tier: string;
  form_fields: { count: number }[] | null;
};

export default async function StorePage() {
  const { supabase, current } = await requireCompany();
  const isAdmin = current.role === "admin";

  const [{ data: company }, { data: forms }] = await Promise.all([
    supabase.from("companies").select("subscription_tier").eq("id", current.company_id).single(),
    supabase
      .from("forms")
      .select("id, name, description, category, store_tier, form_fields(count)")
      .eq("is_store", true)
      .order("created_at", { ascending: false }),
  ]);

  const companyTier = company?.subscription_tier ?? "free";
  const list = (forms ?? []) as unknown as StoreForm[];
  const cards: StoreCard[] = list.map((f) => ({
    id: f.id,
    name: f.name,
    description: f.description,
    category: f.category,
    store_tier: f.store_tier,
    fieldCount: f.form_fields?.[0]?.count ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Form Store"
        subtitle="Ready-made forms. Preview, add to your Forms, or customise before adding."
      >
        <span className="rounded-full border border-white/40 bg-white/20 px-3 py-1 text-xs font-medium text-white">
          Your plan: {TIER_LABEL[companyTier] ?? companyTier}
        </span>
      </PageHeader>

      <div className="mt-6">
        {cards.length === 0 ? (
          <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
            No store forms available yet.
          </div>
        ) : (
          <StoreBrowser forms={cards} companyTier={companyTier} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
