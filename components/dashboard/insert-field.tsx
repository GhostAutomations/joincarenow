"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addFieldOfType } from "@/modules/forms/actions";

const TYPES: { value: string; label: string }[] = [
  { value: "body_text", label: "Body text / heading" },
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Multiple choice" },
  { value: "checkboxes", label: "Checkboxes" },
  { value: "yes_no", label: "Yes / No" },
  { value: "file", label: "File upload" },
  { value: "signature", label: "Signature" },
];

/** The "+" between boxes. Click to open a type picker that inserts a field
 *  after `afterId` ("" = top of the list). */
export function InsertField({
  formId,
  afterId,
}: {
  formId: string;
  afterId: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex justify-center py-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Add a field here"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="my-2 rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-medium text-gray-500">Add a field</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
        {TYPES.map((t) => (
          <form action={addFieldOfType} key={t.value}>
            <input type="hidden" name="formId" value={formId} />
            <input type="hidden" name="afterId" value={afterId} />
            <input type="hidden" name="fieldType" value={t.value} />
            <button
              type="submit"
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-left text-xs text-gray-700 hover:border-brand-300 hover:bg-brand-50"
            >
              {t.label}
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}
