"use client";

import { useActionState, type SyntheticEvent } from "react";
import { saveStoreSettings, type DetailsState } from "@/modules/forms/actions";
import { TIERS, TIER_LABEL } from "@/modules/forms/tiers";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "application", label: "Application forms" },
  { value: "recruitment", label: "Recruitment" },
  { value: "onboarding", label: "Onboarding" },
  { value: "referencing", label: "Referencing" },
  { value: "hr", label: "HR" },
  { value: "other", label: "Other" },
];
const cls =
  "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function StoreSettingsBar({
  formId,
  name,
  category,
  storeTier,
}: {
  formId: string;
  name: string;
  category: string;
  storeTier: string;
}) {
  const [state, action] = useActionState<DetailsState, FormData>(saveStoreSettings, undefined);

  // Auto-save on blur so the name/category persist (e.g. before generating with
  // AI, which reloads the page). A full name + category are required to publish.
  const autosave = (e: SyntheticEvent<HTMLInputElement | HTMLSelectElement>) =>
    e.currentTarget.form?.requestSubmit();

  return (
    <form id="store-settings-form" action={action} className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-4">
      <input type="hidden" name="id" value={formId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-end">
        <label className="text-sm font-medium text-gray-700">
          Form name
          <input
            name="name"
            defaultValue={name === "Untitled form" ? "" : name}
            placeholder="e.g. P46 starter form"
            onBlur={autosave}
            className={cls}
          />
        </label>
        <label className="text-sm font-medium text-gray-700">
          Category
          <select name="category" defaultValue={category || ""} onBlur={autosave} onChange={autosave} className={cls}>
            <option value="" disabled>Select a category…</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Required plan
          <select name="storeTier" defaultValue={storeTier} onChange={autosave} className={cls}>
            {TIERS.map((t) => (
              <option key={t} value={t}>{TIER_LABEL[t]}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-1 h-4 text-xs">
        {state?.ok && <span className="text-green-700">Saved.</span>}
        {state?.error && <span className="text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
