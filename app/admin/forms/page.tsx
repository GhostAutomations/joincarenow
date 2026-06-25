import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createBlankStoreForm } from "@/modules/forms/actions";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { StoreBadge, TierBadge } from "@/components/dashboard/store-badge";
import { categoryLabel, sortCategories } from "@/lib/form-categories";

type StoreFormRow = {
  id: string;
  name: string;
  category: string | null;
  store_tier: string;
  form_fields: { count: number }[] | null;
};

export default async function FounderFormsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, category, store_tier, form_fields(count)")
    .eq("is_store", true)
    .order("name", { ascending: true });

  const rows = (forms ?? []) as unknown as StoreFormRow[];
  const byCategory = new Map<string, StoreFormRow[]>();
  for (const f of rows) {
    const cat = f.category || "other";
    const list = byCategory.get(cat) ?? [];
    list.push(f);
    byCategory.set(cat, list);
  }
  const categories = sortCategories([...byCategory.keys()]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Form Store</h1>
        <form action={createBlankStoreForm}>
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden /> Create form
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-white/80">
        Templates you create here appear in every company&apos;s Form Store.
        Admins can add them to their own forms, gated by their subscription plan.
      </p>

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">No store forms yet.</div>
        ) : (
          categories.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            return (
              <CollapsibleSection key={cat} title={categoryLabel(cat)} count={list.length}>
                <ul className="space-y-1.5">
                  {list.map((f) => {
                    const count = f.form_fields?.[0]?.count ?? 0;
                    return (
                      <li key={f.id}>
                        <Link
                          href={`/admin/forms/${f.id}/build`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/70 backdrop-blur-md p-3.5 hover:border-brand-300"
                        >
                          <span className="font-medium text-gray-900">{f.name}</span>
                          <div className="flex items-center gap-2.5 text-xs text-gray-500">
                            <StoreBadge />
                            <TierBadge tier={f.store_tier} />
                            <span>{count} field{count === 1 ? "" : "s"}</span>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CollapsibleSection>
            );
          })
        )}
      </div>
    </div>
  );
}
