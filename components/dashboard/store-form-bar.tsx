"use client";

import { useActionState, useEffect, useRef, useState, type SyntheticEvent } from "react";
import { useFormStatus } from "react-dom";
import { Globe, EyeOff, Sparkles, Save, Check } from "lucide-react";
import {
  saveStoreSettings,
  setStorePublished,
  regenerateFormFromBrief,
  type DetailsState,
  type ImportState,
} from "@/modules/forms/actions";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "application", label: "Application forms" },
  { value: "recruitment", label: "Recruitment" },
  { value: "onboarding", label: "Onboarding" },
  { value: "referencing", label: "Referencing" },
  { value: "hr", label: "HR" },
  { value: "other", label: "Other" },
];
const cls =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function StoreFormBar({
  formId,
  name,
  category,
  pricePence,
  published,
}: {
  formId: string;
  name: string;
  category: string;
  pricePence: number;
  published: boolean;
}) {
  const [saveState, saveAction] = useActionState<DetailsState, FormData>(saveStoreSettings, undefined);
  const [pubState, pubAction] = useActionState<DetailsState, FormData>(setStorePublished, undefined);
  const [regenState, regenAction] = useActionState<ImportState, FormData>(regenerateFormFromBrief, undefined);
  // The button shows green "Saved" only after an explicit Save click; any edit
  // flips it back to white "Save". (Auto-save on blur still persists silently so
  // nothing is lost on the AI reload — it just doesn't turn the button green.)
  const [manualSaved, setManualSaved] = useState(false);
  const clickedSave = useRef(false);
  const [showRegen, setShowRegen] = useState(false);
  const [brief, setBrief] = useState("");
  // Controlled so React 19's post-action form reset doesn't snap these back to
  // their defaults (that was making the category jump back to "Recruitment").
  const [nameV, setNameV] = useState(name === "Untitled form" ? "" : name);
  const [categoryV, setCategoryV] = useState(category || "");
  const [priceV, setPriceV] = useState(pricePence > 0 ? (pricePence / 100).toFixed(2) : "");

  useEffect(() => {
    if (saveState?.ok && clickedSave.current) {
      setManualSaved(true);
      clickedSave.current = false;
    }
  }, [saveState]);
  useEffect(() => {
    if (regenState?.added) window.location.assign(`${window.location.pathname}?view=builder`);
  }, [regenState]);
  // Editing the questions in the builder below also counts as an unsaved change.
  useEffect(() => {
    const onEdited = () => setManualSaved(false);
    window.addEventListener("jcn-form-edited", onEdited);
    return () => window.removeEventListener("jcn-form-edited", onEdited);
  }, []);

  const autosave = (e: SyntheticEvent<HTMLInputElement | HTMLSelectElement>) =>
    e.currentTarget.form?.requestSubmit();
  const saved = manualSaved;

  return (
    <div className="space-y-3">
      {/* Settings (auto-save on blur) */}
      <form
        id="store-settings-form"
        action={saveAction}
        onChange={() => setManualSaved(false)}
        className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md"
      >
        <input type="hidden" name="id" value={formId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
          <label className="text-sm font-medium text-gray-700">
            Form name
            <input name="name" value={nameV} onChange={(e) => setNameV(e.target.value)} placeholder="e.g. P46 starter form" onBlur={autosave} className={cls} />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Category
            <select
              name="category"
              value={categoryV}
              onChange={(e) => { setCategoryV(e.target.value); e.currentTarget.form?.requestSubmit(); }}
              className={cls}
            >
              <option value="" disabled>Select a category…</option>
              {CATEGORIES.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Price
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">£</span>
              <input
                name="price"
                inputMode="decimal"
                value={priceV}
                onChange={(e) => setPriceV(e.target.value)}
                onBlur={autosave}
                placeholder="0.00"
                className={`${cls} mt-0 pl-7`}
              />
            </div>
            <span className="mt-1 block text-xs text-gray-400">Leave blank or 0 for a free / included form.</span>
          </label>
        </div>
      </form>

      {/* Action bar */}
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
            {(pubState?.error || saveState?.error) && (
              <span className="text-sm text-red-600">{pubState?.error || saveState?.error}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              form="store-settings-form"
              onClick={() => { clickedSave.current = true; }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium ${
                saved
                  ? "bg-green-600 text-white hover:bg-green-700"
                  : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {saved ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
              {saved ? "Saved" : "Save"}
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
              className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2 flex items-center gap-3">
              <RegenSubmit disabled={brief.trim().length < 3} />
              {regenState?.error && <span className="text-sm text-red-600">{regenState.error}</span>}
            </div>
          </form>
        )}
      </div>
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
