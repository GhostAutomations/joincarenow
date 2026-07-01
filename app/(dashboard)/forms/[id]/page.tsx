import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { deleteForm } from "@/modules/forms/actions";
import { FormDetailsForm } from "@/components/dashboard/form-details-form";
import { DeleteFormButton } from "@/components/dashboard/delete-form-button";

export default async function FormDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, category")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!form) notFound();

  const { count: fieldCount } = await supabase
    .from("form_fields")
    .select("id", { count: "exact", head: true })
    .eq("form_id", id);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/forms"
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to forms
        </Link>
        <DeleteFormButton
          action={deleteForm}
          formId={form.id}
          fieldCount={fieldCount ?? 0}
          label="Delete form"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600"
        />
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-white drop-shadow-sm">Form builder</h1>

      <div className="mt-4">
        <FormDetailsForm
          formId={form.id}
          name={form.name}
          category={(form as { category?: string }).category ?? "recruitment"}
        />
      </div>
    </div>
  );
}
