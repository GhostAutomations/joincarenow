"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveFormHeader, type DetailsState } from "@/modules/forms/actions";

/** The editable header at the top of the builder: form title (heading-size)
 *  and a description / how-to-complete note. */
export function FormHeaderEditor({
  formId,
  name,
  description,
}: {
  formId: string;
  name: string;
  description: string;
}) {
  const [state, action] = useActionState<DetailsState, FormData>(
    saveFormHeader,
    undefined
  );
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="rounded-xl border border-gray-200 bg-white p-6">
      {state?.error && (
        <p className="mb-3 rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <input type="hidden" name="id" value={formId} />

      <input
        name="name"
        required
        defaultValue={name === "Untitled form" ? "" : name}
        placeholder="Form title"
        className="block w-full border-0 border-b border-transparent px-0 text-2xl font-bold text-gray-900 placeholder-gray-300 focus:border-brand-500 focus:outline-none focus:ring-0"
      />
      <textarea
        name="description"
        rows={3}
        defaultValue={description}
        placeholder="Add a description — e.g. how to complete this form, what's needed…"
        className="mt-3 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />

      <div className="mt-3 flex items-center gap-3">
        <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
          Save title &amp; description
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
      </div>
    </form>
  );
}
