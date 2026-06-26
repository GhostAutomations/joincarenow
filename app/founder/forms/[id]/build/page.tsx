import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Sparkles, FileUp } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { deleteStoreForm } from "@/modules/forms/actions";
import { MondayFormBuilder, type BuilderField } from "@/components/dashboard/monday-form-builder";
import { StoreFormBar } from "@/components/dashboard/store-form-bar";
import { DeleteFormButton } from "@/components/dashboard/delete-form-button";
import { BuildTabs } from "@/components/dashboard/build-tabs";
import { PdfImport } from "@/components/dashboard/pdf-import";
import { FormAiGenerate } from "@/components/dashboard/form-ai-generate";

// PDF import calls Claude, which can take longer than the default function limit.
export const maxDuration = 60;

export default async function FounderFormBuildPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const initialMode = view === "builder" ? "builder" : view === "import" ? "import" : null;
  const { supabase } = await requirePlatformAdmin();

  const { data: form } = await supabase
    .from("forms")
    .select("id, name, description, style, category, store_tier, store_published")
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

  const { data: bank } = await supabase
    .from("question_templates")
    .select("id, label, field_type, options, help_text, category")
    .order("category")
    .order("position");

  const builder = (
    <MondayFormBuilder
      form={{
        id: form.id,
        name: form.name,
        description: (form as { description?: string | null }).description ?? "",
        style: (form as { style?: Record<string, unknown> }).style ?? {},
      }}
      fields={fields}
      questionBank={(bank ?? []) as never}
      defaultLogo="/brand/jcn-mark-transparent.png"
      defaultLogoLabel="the Join Care Now logo"
    />
  );

  const importer = (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          Generate with AI
        </h2>
        <div className="mt-3">
          <FormAiGenerate formId={form.id} />
        </div>
      </div>

      <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gray-100 text-gray-600">
            <FileUp className="h-4 w-4" aria-hidden />
          </span>
          Import from a PDF
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload an existing form (PDF) and we&apos;ll read it and add the questions for you to review and edit.
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
          href="/founder/forms"
          className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to Form Store
        </Link>
        <DeleteFormButton action={deleteStoreForm} formId={form.id} fieldCount={fields.length} />
      </div>

      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">
        {form.name || "Untitled form"}
      </h1>
      <p className="text-sm text-white/80">Store form · set its category and plan below.</p>

      {/* Store settings + actions, above the tabs. */}
      <div className="mt-4">
        <StoreFormBar
          formId={form.id}
          name={form.name ?? ""}
          category={(form as { category?: string }).category ?? ""}
          storeTier={(form as { store_tier?: string }).store_tier ?? "free"}
          published={(form as { store_published?: boolean }).store_published ?? false}
        />
      </div>

      <div className="mt-2">
        <BuildTabs builder={builder} importer={importer} initialMode={initialMode} />
      </div>
    </div>
  );
}
