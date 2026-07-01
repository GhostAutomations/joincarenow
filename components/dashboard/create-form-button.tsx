"use client";

import { useActionState } from "react";
import type { FormState } from "@/modules/forms/actions";

export function CreateFormButton({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1">
        {state?.error && (
          <p className="mb-1 text-xs text-red-600">{state.error}</p>
        )}
        <label className="block text-sm font-medium text-gray-700">
          Form name
          <input
            name="name"
            placeholder="e.g. Care Assistant application"
            className="mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>
      </div>
      <div className="sm:w-40">
        <button className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
          Create form
        </button>
      </div>
    </form>
  );
}
