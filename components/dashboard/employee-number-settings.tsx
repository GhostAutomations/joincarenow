"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setEmployeeNumberSettings, type SettingsState } from "@/modules/companies/actions";

export function EmployeeNumberSettings({
  companyId,
  mode: initialMode,
  prefix: initialPrefix,
  submitLabel = "Save",
}: {
  companyId: string;
  mode: "auto" | "manual";
  prefix: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(
    setEmployeeNumberSettings,
    undefined
  );
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) { router.refresh(); window.dispatchEvent(new Event("jcn-section-saved")); }
  }, [state, router]);
  const [manual, setManual] = useState(initialMode === "manual");

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="mode" value={manual ? "manual" : "auto"} />

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={manual}
          onChange={(e) => setManual(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
        />
        <span className="text-sm text-gray-700">
          <span className="font-medium text-gray-900">Enter employee numbers manually</span>
          <br />
          Turn this on if you already use your own payroll / employee numbers. New
          hires are created with a blank number for you to fill in. Leave off to
          auto‑generate them.
        </span>
      </label>

      {!manual && (
        <label className="block text-xs font-medium text-gray-600">
          Auto‑number prefix
          <input
            name="prefix"
            defaultValue={initialPrefix || "EMP-"}
            placeholder="EMP-"
            className="mt-1 block w-40 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <span className="mt-1 block font-normal text-gray-400">
            New hires become {(initialPrefix || "EMP-")}0001, {(initialPrefix || "EMP-")}0002…
          </span>
        </label>
      )}

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {submitLabel}
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
