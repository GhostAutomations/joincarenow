import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { FieldRow } from "@/components/dashboard/field-row";
import { InsertField } from "@/components/dashboard/insert-field";
import { PdfImport } from "@/components/dashboard/pdf-import";
import { FormHeaderEditor } from "@/components/dashboard/form-header-editor";

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

export default async function FormBuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, description")
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
      <Link
        href={`/forms/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to form details
      </Link>

      {/* Editable title + description */}
      <div className="mt-3">
        <FormHeaderEditor
          formId={form.id}
          name={form.name}
          description={(form as { description?: string | null }).description ?? ""}
        />
      </div>

      {/* The builder canvas */}
      <div className="mt-6">
        {/* Locked Name box — always first; links to the applicant */}
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900">Full name</p>
            <span className="inline-flex items-center gap-1 text-xs text-gray-400">
              <Lock className="h-3.5 w-3.5" /> Always included
            </span>
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            Collected automatically and used to link the application to the
            applicant&apos;s account.
          </p>
        </div>

        {/* Insert at the very top (e.g. a heading / body text) */}
        <InsertField formId={form.id} afterId="" />

        {fields.map((f, i) => (
          <div key={f.id}>
            <FieldRow
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
            <InsertField formId={form.id} afterId={f.id} />
          </div>
        ))}
      </div>

      {/* Import from a PDF */}
      <div className="mt-6 rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-900">
          Or import questions from a PDF
        </h2>
        <div className="mt-3">
          <PdfImport formId={form.id} />
        </div>
      </div>
    </div>
  );
}
