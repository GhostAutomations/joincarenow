import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createBlankStoreForm, TIER_LABEL } from "@/modules/forms/actions";

export default async function FounderFormsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, category, store_tier, form_fields(count)")
    .eq("is_store", true)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Form Store</h1>
        <form action={createBlankStoreForm}>
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden /> Create form
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Templates you create here appear in every company&apos;s Form Store.
        Admins can add them to their own forms, gated by their subscription plan.
      </p>

      <div className="mt-6">
        {(forms ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No store forms yet.</p>
        ) : (
          <ul className="space-y-2">
            {(forms ?? []).map((f) => {
              const count =
                (f.form_fields as unknown as { count: number }[] | null)?.[0]?.count ?? 0;
              return (
                <li key={f.id}>
                  <Link
                    href={`/admin/forms/${f.id}/build`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300"
                  >
                    <div>
                      <span className="font-medium text-gray-900">{f.name}</span>
                      <span className="ml-2 text-xs capitalize text-gray-400">{f.category}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                        {TIER_LABEL[f.store_tier] ?? f.store_tier}
                      </span>
                      <span>{count} field{count === 1 ? "" : "s"}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
