"use client";

import { Trash2 } from "lucide-react";

/** Delete button for a form. If the form has fields, asks for confirmation
 *  first (deletes are permanent and cascade to all its fields/submissions). */
export function DeleteFormButton({
  action,
  formId,
  fieldCount,
  label = "Delete",
  className = "inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur-sm hover:bg-white/25",
}: {
  action: (formData: FormData) => void | Promise<void>;
  formId: string;
  fieldCount: number;
  label?: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (
          fieldCount > 0 &&
          !window.confirm(
            `This form has ${fieldCount} field${fieldCount === 1 ? "" : "s"}. ` +
              `Deleting it is permanent and removes all its fields. Are you sure?`
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={formId} />
      <button className={className}>
        <Trash2 className="h-4 w-4" /> {label}
      </button>
    </form>
  );
}
