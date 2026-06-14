import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createBlankForm } from "@/modules/forms/actions";

export default async function FormsPage() {
  const { supabase, current } = await requireCompany();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, purpose, created_at, form_fields(count)")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Forms</h1>
        <form action={createBlankForm}>
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" aria-hidden />
            Create a form
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Build custom application forms and assign them to your jobs. Applicants
        answer these on top of the built-in basics (name, contact, CV).
      </p>

      <div className="mt-6">
        {(forms ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="text-sm font-medium text-gray-900">No forms yet</p>
            <p className="mt-1 text-sm text-gray-500">
              Create your first form, then add fields to it.
            </p>
            <form action={createBlankForm} className="mt-4">
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                <Plus className="h-4 w-4" aria-hidden />
                Create a form
              </button>
            </form>
          </div>
        ) : (
          <ul className="space-y-2">
            {(forms ?? []).map((f) => {
              const count =
                (f.form_fields as unknown as { count: number }[] | null)?.[0]
                  ?.count ?? 0;
              return (
                <li key={f.id}>
                  <Link
                    href={`/forms/${f.id}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-300"
                  >
                    <span className="font-medium text-gray-900">{f.name}</span>
                    <span className="text-xs text-gray-500">
                      {count} field{count === 1 ? "" : "s"}
                    </span>
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
