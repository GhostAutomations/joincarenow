"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Globe, EyeOff, Sparkles, Save } from "lucide-react";
import {
  setStorePublished,
  regenerateFormFromBrief,
  type DetailsState,
  type ImportState,
} from "@/modules/forms/actions";

export function StorePublishBar({ formId, published }: { formId: string; published: boolean }) {
  const [pubState, pubAction] = useActionState<DetailsState, FormData>(setStorePublished, undefined);
  const [regenState, regenAction] = useActionState<ImportState, FormData>(regenerateFormFromBrief, undefined);
  const [showRegen, setShowRegen] = useState(false);
  const [brief, setBrief] = useState("");

  // After a successful regenerate, jump to the builder to see the new questions.
  useEffect(() => {
    if (regenState?.added) window.location.assign(`${window.location.pathname}?view=builder`);
  }, [regenState]);

  return (
    <div className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          {published ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800">
              <Globe className="h-3.5 w-3.5" /> Live in the Form Store
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800">
              <EyeOff className="h-3.5 w-3.5" /> Draft — not visible to companies
            </span>
          )}
          {pubState?.error && <span className="text-sm text-red-600">{pubState.error}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Save the form's name/category/plan (the settings form lives above). */}
          <button
            form="store-settings-form"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-white/60"
          >
            <Save className="h-4 w-4" /> Save
          </button>

          <form action={pubAction}>
            <input type="hidden" name="id" value={formId} />
            <input type="hidden" name="publish" value={(!published).toString()} />
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white ${
                published ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => setShowRegen((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" /> Regenerate with AI
          </button>
        </div>
      </div>

      {showRegen && (
        <form action={regenAction} className="mt-3 rounded-xl border border-brand-100 bg-brand-50/50 p-3">
          <input type="hidden" name="formId" value={formId} />
          <p className="text-xs font-medium text-amber-700">
            AI can&apos;t edit the questions already on the form — this generates a brand-new form and
            <strong> replaces all current questions</strong>.
          </p>
          <textarea
            name="brief"
            required
            rows={3}
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe the form you want instead…"
            className="mt-2 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <div className="mt-2 flex items-center gap-3">
            <RegenSubmit disabled={brief.trim().length < 3} />
            {regenState?.error && <span className="text-sm text-red-600">{regenState.error}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function RegenSubmit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending || disabled}
      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Sparkles className="h-4 w-4" /> {pending ? "Generating…" : "Regenerate form"}
    </button>
  );
}
