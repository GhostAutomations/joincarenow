"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { moveField, deleteField } from "@/modules/forms/actions";
import { FieldForm, type FieldDefaults } from "@/components/dashboard/field-form";

const TYPE_LABEL: Record<string, string> = {
  short_text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  radio: "Multiple choice",
  checkboxes: "Checkboxes",
  yes_no: "Yes / No",
  file: "File upload",
};

export function FieldRow({
  field,
  formId,
  isFirst,
  isLast,
}: {
  field: FieldDefaults & { field_type: string };
  formId: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="rounded-lg border border-brand-200 bg-brand-50/40 p-4">
        <FieldForm
          formId={formId}
          defaults={field}
          onSaved={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">
          {field.label}
          {field.required && <span className="ml-1 text-red-500">*</span>}
        </p>
        <p className="text-xs text-gray-500">
          {TYPE_LABEL[field.field_type] ?? field.field_type}
          {field.options.length > 0 && ` · ${field.options.length} options`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <form action={moveField}>
          <input type="hidden" name="id" value={field.id} />
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="direction" value="up" />
          <button
            disabled={isFirst}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            aria-label="Move up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </form>
        <form action={moveField}>
          <input type="hidden" name="id" value={field.id} />
          <input type="hidden" name="formId" value={formId} />
          <input type="hidden" name="direction" value="down" />
          <button
            disabled={isLast}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
            aria-label="Move down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </form>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Edit"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <form action={deleteField}>
          <input type="hidden" name="id" value={field.id} />
          <input type="hidden" name="formId" value={formId} />
          <button
            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </form>
      </div>
    </li>
  );
}
