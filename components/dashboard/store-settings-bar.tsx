"use client";

import { useActionState } from "react";
import { saveStoreSettings, type DetailsState } from "@/modules/forms/actions";
import { TIERS, TIER_LABEL } from "@/modules/forms/tiers";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "recruitment", label: "Recruitment" },
  { value: "hr", label: "HR" },
  { value: "onboarding", label: "Onboarding" },
  { value: "other", label: "Other" },
];
const cls =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function StoreSettingsBar({
  formId,
  category,
  storeTier,
}: {
  formId: string;
  category: string;
  storeTier: string;
}) {
  const [state, action] = useActionState<DetailsState, FormData>(saveStoreSettings, undefined);

  return (
    <form action={action} className="rounded-xl border border-gray-200 bg-white p-4">
      <input type="hidden" name="id" value={formId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-gray-700">
          Category
          <select name="category" defaultValue={category} className={cls}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Required plan
          <select name="storeTier" defaultValue={storeTier} className={cls}>
            {TIERS.map((t) => (
              <option key={t} value={t}>{TIER_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save
          </button>
          {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        </div>
      </div>
    </form>
  );
}
