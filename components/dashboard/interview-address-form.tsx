"use client";

import { useActionState } from "react";
import { setInterviewAddress, type SettingsState } from "@/modules/companies/actions";

export function InterviewAddressForm({
  companyId,
  defaultValue,
  submitLabel = "Save address",
}: {
  companyId: string;
  defaultValue: string;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(
    setInterviewAddress,
    undefined
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="companyId" value={companyId} />
      <textarea
        name="interviewAddress"
        rows={3}
        defaultValue={defaultValue}
        placeholder="e.g. Thistle Care, 12 High Street, Cardiff, CF10 1AB"
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
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
