import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { deleteStoreForm } from "@/modules/forms/actions";
import { MondayFormBuilder, type BuilderField } from "@/components/dashboard/monday-form-builder";
import { StoreSettingsBar } from "@/components/dashboard/store-settings-bar";
import { BuildTabs } from "@/components/dashboard/build-tabs";
import { PdfImport } from "@/components/dashboard/pdf-import";

// PDF import calls Claude, which can take longer than the default function limit.
export const maxDuration = 60;

export default async function FounderFormBuildPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requirePlatformAdmin();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, description, style, category, store_tier")
    .eq("id", id)
    .eq("is_store", true)
    .single();
  if (!form) notFound();

  const { data: fieldsData } = await supabase
    .from("form_fields")
    .select("id, label, field_type, required, options, help_text, config, parent_field_id, parent_value, position")
    .eq("form_id", id)
    .order("position", { ascending: true });
  const fields = (fieldsData ?? []) as BuilderField[];

  const settings = (
    <StoreSettingsBar
      formId={form.id}
      category={(form as { category?: string }).category ?? "recruitment"}
      storeTier={(form as { store_tier?: string }).store_tier ?? "free"}
    />
  );

  const builder = (
    <div className="space-y-4">
      {settings}
      <MondayFormBuilder
        form={{
          id: form.id,
          name: form.name,
          description: (form as { description?: string | null }).description ?? "",
          style: (form as { style?: Record<string, unknown> }).style ?? {},
        }}
        fields={fields}
      />
    </div>
  );

  const importer = (
    <div className="space-y-4">
      {settings}
      <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-gray-300 bg-white p-5">
        <h2 className="text-sm font-medium text-gray-900">Import questions from a PDF</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an existing form (PDF) and we&apos;ll read it and add the
          questions for you to review and edit.
        </p>
        <div className="mt-3">
          <PdfImport formId={form.id} />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/forms"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Form Store
        </Link>
        <form action={deleteStoreForm}>
          <input type="hidden" name="id" value={form.id} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </form>
      </div>

      <div className="mt-4">
        <BuildTabs builder={builder} importer={importer} />
      </div>
    </div>
  );
}
