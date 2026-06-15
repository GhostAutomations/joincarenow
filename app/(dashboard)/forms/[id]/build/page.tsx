import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PdfImport } from "@/components/dashboard/pdf-import";
import { BuildTabs } from "@/components/dashboard/build-tabs";
import { MondayFormBuilder, type BuilderField } from "@/components/dashboard/monday-form-builder";

// PDF import calls Claude, which can take longer than the default function
// limit. Allow up to 60s (Vercel Hobby cap) for this route's server actions.
export const maxDuration = 60;

export default async function FormBuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, description, style")
    .eq("id", id)
    .eq("company_id", current.company_id)
    .single();
  if (!form) notFound();

  const { data: fieldsData } = await supabase
    .from("form_fields")
    .select("id, label, field_type, required, options, help_text, config, position")
    .eq("form_id", id)
    .order("position", { ascending: true });
  const fields = (fieldsData ?? []) as BuilderField[];

  const builder = (
    <MondayFormBuilder
      form={{
        id: form.id,
        name: form.name,
        description: (form as { description?: string | null }).description ?? "",
        style: (form as { style?: Record<string, unknown> }).style ?? {},
      }}
      fields={fields}
    />
  );

  const importer = (
    <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-5">
      <h2 className="text-sm font-medium text-gray-900">Import questions from a PDF</h2>
      <p className="mt-1 text-sm text-gray-500">
        Upload an existing application form (PDF) and we&apos;ll read it and add
        the questions for you to review and edit.
      </p>
      <div className="mt-3">
        <PdfImport formId={form.id} />
      </div>
    </div>
  );

  return (
    <div>
      <Link
        href={`/forms/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to form details
      </Link>

      <div className="mt-3">
        <BuildTabs builder={builder} importer={importer} />
      </div>
    </div>
  );
}
