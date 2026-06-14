import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { deleteForm } from "@/modules/forms/actions";
import { FieldForm } from "@/components/dashboard/field-form";
import { FieldRow } from "@/components/dashboard/field-row";
import { PdfImport } from "@/components/dashboard/pdf-import";
import { FormBuilderShell } from "@/components/dashboard/form-builder-shell";

// PDF import calls Claude, which can take longer than the default function
// limit. Allow up to 60s (Vercel Hobby cap) for this route's server actions.
export const maxDuration = 60;

type Field = {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  help_text: string | null;
  config: { text?: string; size?: string; color?: string } | null;
  position: number;
};

export default async function FormEditorPage({
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

  const { data: fieldsData } = await supabase
    .from("form_fields")
    .select("id, label, field_type, required, options, help_text, config, position")
    .eq("form_id", id)
    .order("position", { ascending: true });
  const fields = (fieldsData ?? []) as Field[];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/forms"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to forms
        </Link>
        <form action={deleteForm}>
          <input type="hidden" name="id" value={form.id} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" /> Delete form
          </button>
        </form>
      </div>

      <h1 className="mt-3 text-2xl font-semibold text-gray-900">Form builder</h1>

      <div className="mt-4">
        <FormBuilderShell
          formId={form.id}
          name={form.name}
          category={(form as { category?: string }).category ?? "recruitment"}
          hasFields={fields.length > 0}
        >
          {/* Import from a PDF */}
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
            <h2 className="text-sm font-medium text-gray-900">Import from a PDF</h2>
            <div className="mt-3">
              <PdfImport formId={form.id} />
            </div>
          </div>

          {/* Existing fields */}
          {fields.length > 0 && (
            <ul className="mt-6 space-y-2">
              {fields.map((f, i) => (
                <FieldRow
                  key={f.id}
                  formId={form.id}
                  isFirst={i === 0}
                  isLast={i === fields.length - 1}
                  field={{
                    id: f.id,
                    label: f.label,
                    field_type: f.field_type,
                    fieldType: f.field_type,
                    required: f.required,
                    options: f.options ?? [],
                    helpText: f.help_text ?? "",
                    config: f.config ?? null,
                  }}
                />
              ))}
            </ul>
          )}

          {/* Add a field */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-medium text-gray-900">Add a field</h3>
            <div className="mt-3">
              <FieldForm formId={form.id} />
            </div>
          </div>
        </FormBuilderShell>
      </div>
    </div>
  );
}
