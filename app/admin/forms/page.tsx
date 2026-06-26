import { Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createBlankStoreForm } from "@/modules/forms/actions";
import { FounderStoreBrowser, type FounderStoreCard } from "@/components/dashboard/founder-store-browser";

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

  const cards: FounderStoreCard[] = ((forms ?? []) as unknown as StoreFormRow[]).map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category || "other",
    store_tier: f.store_tier,
    fieldCount: f.form_fields?.[0]?.count ?? 0,
  }));

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

      <div className="mt-6">
        <FounderStoreBrowser forms={cards} />
      </div>
    </div>
  );
}
