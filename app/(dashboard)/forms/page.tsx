import Link from "next/link";
import { Plus } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { createBlankForm, deleteForm } from "@/modules/forms/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { categoryLabel, sortCategories } from "@/lib/form-categories";
import { StoreBadge } from "@/components/dashboard/store-badge";
import { DeleteFormButton } from "@/components/dashboard/delete-form-button";

type FormRow = {
  id: string;
  name: string;
  category: string | null;
  source_form_id: string | null;
  form_fields: { count: number }[] | null;
};

export default async function FormsPage() {
  const { supabase, current } = await requireCompany();

  const { data: forms } = await supabase
    .from("forms")
    .select("id, name, category, source_form_id, created_at, form_fields(count)")
    .eq("company_id", current.company_id)
    .order("name", { ascending: true });

  // Group forms by category for the collapsible sections.
  const rows = (forms ?? []) as unknown as FormRow[];
  const byCategory = new Map<string, FormRow[]>();
  for (const f of rows) {
    const cat = f.category || "other";
    const list = byCategory.get(cat) ?? [];
    list.push(f);
    byCategory.set(cat, list);
  }
  const categories = sortCategories([...byCategory.keys()]);

  return (
    <div>
      <PageHeader
        title="Forms"
        subtitle="Build custom application forms and assign them to your jobs. Applicants answer these on top of the built-in basics (name, contact, CV)."
      >
        <form action={createBlankForm}>
          <button className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-6 py-3 text-base font-semibold text-white shadow-sm backdrop-blur hover:bg-white/30">
            <Plus className="h-5 w-5" aria-hidden />
            Create a form
          </button>
        </form>
      </PageHeader>

      <div className="mt-6 space-y-3">
        {rows.length === 0 ? (
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
          categories.map((cat) => {
            const list = byCategory.get(cat) ?? [];
            return (
              <CollapsibleSection key={cat} title={categoryLabel(cat)} count={list.length}>
                <ul className="space-y-1.5">
                  {list.map((f) => {
                    const count = f.form_fields?.[0]?.count ?? 0;
                    return (
                      <li key={f.id} className="flex items-center gap-2">
                        <Link
                          href={`/forms/${f.id}`}
                          className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-white/40 bg-white/70 backdrop-blur-md p-3.5 hover:border-brand-300"
                        >
                          <span className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{f.name}</span>
                            {f.source_form_id && <StoreBadge />}
                          </span>
                          <span className="text-xs text-gray-500">
                            {count} field{count === 1 ? "" : "s"}
                          </span>
                        </Link>
                        <DeleteFormButton
                          action={deleteForm}
                          formId={f.id}
                          fieldCount={count}
                          label="Delete"
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-white/40 bg-white/70 px-3.5 py-3.5 text-sm text-gray-600 backdrop-blur-md hover:border-red-300 hover:text-red-600"
                        />
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
