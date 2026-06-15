import { requireCompany } from "@/modules/auth/queries";
import { acquireStoreForm, TIERS, TIER_LABEL } from "@/modules/forms/actions";

const tierRank = (t: string) => Math.max(0, TIERS.indexOf(t));

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

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Form Store</h1>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
          Your plan: {TIER_LABEL[companyTier] ?? companyTier}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Ready-made forms. Add one to your Forms to edit it and assign it to jobs.
      </p>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No store forms available yet.</p>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {list.map((f) => {
            const fieldCount = f.form_fields?.[0]?.count ?? 0;
            const unlocked = tierRank(companyTier) >= tierRank(f.store_tier);
            return (
              <div key={f.id} className="flex flex-col rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{f.name}</p>
                    <p className="text-xs capitalize text-gray-400">{f.category}</p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.store_tier === "free"
                        ? "bg-green-100 text-green-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {TIER_LABEL[f.store_tier] ?? f.store_tier}
                  </span>
                </div>
                {f.description && (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-600">{f.description}</p>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  {fieldCount} field{fieldCount === 1 ? "" : "s"}
                </p>

                <div className="mt-4">
                  {!isAdmin ? (
                    <p className="text-xs text-gray-400">Only admins can add store forms.</p>
                  ) : unlocked ? (
                    <form action={acquireStoreForm}>
                      <input type="hidden" name="storeFormId" value={f.id} />
                      <button className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                        Add to my forms
                      </button>
                    </form>
                  ) : (
                    <button
                      disabled
                      className="w-full cursor-not-allowed rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
                    >
                      Requires {TIER_LABEL[f.store_tier] ?? f.store_tier} plan
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
