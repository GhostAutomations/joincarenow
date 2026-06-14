import Link from "next/link";
import { requireCompany } from "@/modules/auth/queries";
import { createForm } from "@/modules/forms/actions";
import { CreateFormButton } from "@/components/dashboard/create-form-button";

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
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Build custom application forms and assign them to your jobs. Applicants
        answer these on top of the built-in basics (name, contact, CV).
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-base font-medium text-gray-900">Create a form</h2>
        <div className="mt-3">
          <CreateFormButton action={createForm} />
        </div>
      </div>

      <div className="mt-6">
        {(forms ?? []).length === 0 ? (
          <p className="text-sm text-gray-500">No forms yet.</p>
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
