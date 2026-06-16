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
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
      <h2 className="text-base font-medium text-gray-900">Import questions from a PDF</h2>
      <p className="mt-1 text-sm text-gray-500">
        Upload an existing form (PDF) and we&apos;ll read it and add the
        questions for you to review and edit.
      </p>
      <div className="mt-3">
        <PdfImport formId={form.id} />
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/forms"
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Form Store
        </Link>
        <form action={deleteStoreForm}>
          <input type="hidden" name="id" value={form.id} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-white/25">
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </form>
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">
        {form.name || "Untitled form"}
      </h1>
      <p className="text-sm text-white/80">Store form · set its category and plan below.</p>

      {/* Store settings shown once, above the tabs (matches the admin flow). */}
      <div className="mt-4">
        <StoreSettingsBar
          formId={form.id}
          category={(form as { category?: string }).category ?? "recruitment"}
          storeTier={(form as { store_tier?: string }).store_tier ?? "free"}
        />
      </div>

      <div className="mt-2">
        <BuildTabs builder={builder} importer={importer} />
      </div>
    </div>
  );
}
