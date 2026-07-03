import { Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createBlankStoreForm } from "@/modules/forms/actions";
import { FounderStoreBrowser, type FounderStoreCard } from "@/components/dashboard/founder-store-browser";

type StoreFormRow = {
  id: string;
  name: string;
  category: string | null;
  price_pence: number | null;
  store_published: boolean | null;
  form_fields: { count: number }[] | null;
};

export default async function FounderFormsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, category, price_pence, store_published, form_fields(count)")
    .eq("is_store", true)
    .order("name", { ascending: true });

  const cards: FounderStoreCard[] = ((forms ?? []) as unknown as StoreFormRow[]).map((f) => ({
    id: f.id,
    name: f.name,
    category: f.category || "other",
    price_pence: f.price_pence ?? 0,
    fieldCount: f.form_fields?.[0]?.count ?? 0,
    published: f.store_published ?? false,
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">File Store</h1>
        <form action={createBlankStoreForm}>
          <button className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-brand-700">
            <Plus className="h-5 w-5" aria-hidden /> Create form
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-white/80">
        Templates you create here appear in every company&apos;s File Store.
        Free templates add instantly; priced ones are bought per form.
      </p>

      <div className="mt-6">
        <FounderStoreBrowser forms={cards} />
      </div>
    </div>
  );
}
