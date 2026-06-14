"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveFormDetails, type DetailsState } from "@/modules/forms/actions";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "recruitment", label: "Recruitment" },
  { value: "hr", label: "HR" },
  { value: "onboarding", label: "Onboarding" },
  { value: "other", label: "Other" },
];

const cls =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function FormBuilderShell({
  formId,
  name,
  category,
  hasFields,
  children,
}: {
  formId: string;
  name: string;
  category: string;
  hasFields: boolean;
  children: React.ReactNode;
}) {
  const [state, action] = useActionState<DetailsState, FormData>(
    saveFormDetails,
    undefined
  );
  const [open, setOpen] = useState(hasFields);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok) {
      setOpen(true);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      <form action={action} className="rounded-xl border border-gray-200 bg-white p-6">
        {state?.error && (
          <p className="mb-3 rounded-md bg-red-50 px-2 py-1 text-sm text-red-700">
            {state.error}
          </p>
        )}
        <input type="hidden" name="id" value={formId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Form name
            <input
              name="name"
              required
              defaultValue={name === "Untitled form" ? "" : name}
              placeholder="e.g. Care Assistant application"
              className={cls}
            />
          </label>
          <label className="text-sm font-medium text-gray-700">
            Category
            <select name="category" defaultValue={category} className={cls}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            {open ? "Save details" : "Open form builder"}
          </button>
          {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        </div>
      </form>

      {open && <div className="mt-6">{children}</div>}
    </div>
  );
}
