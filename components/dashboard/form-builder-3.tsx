"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import {
  addFieldOfType,
  deleteField,
  moveField,
} from "@/modules/forms/actions";
import { FieldForm, type FieldDefaults } from "@/components/dashboard/field-form";
import { FormHeaderEditor } from "@/components/dashboard/form-header-editor";

export type BuilderField = {
  id: string;
  label: string;
  field_type: string;
  required: boolean;
  options: string[];
  help_text: string | null;
  config: { text?: string; size?: string; color?: string } | null;
};

type FormMeta = {
  id: string;
  name: string;
  description: string;
  style: { title?: { color?: string; size?: string; align?: string }; description?: { color?: string; size?: string; align?: string }; logo_url?: string };
};

const PALETTE: { group: string; items: { value: string; label: string }[] }[] = [
  { group: "Layout", items: [{ value: "body_text", label: "Body text / heading" }] },
  {
    group: "Inputs",
    items: [
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
    ],
  },
];

const SIZE_CLASS: Record<string, string> = {
  sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl", "3xl": "text-3xl",
};
const TYPE_LABEL: Record<string, string> = {
  short_text: "Short text", long_text: "Long text", number: "Number", date: "Date",
  dropdown: "Dropdown", radio: "Multiple choice", checkboxes: "Checkboxes",
  yes_no: "Yes / No", file: "File upload", signature: "Signature", body_text: "Body text",
};
function alignClass(a?: string) {
  return a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";
}

type Selection = { kind: "header" } | { kind: "field"; id: string };

export function FormBuilder3({ form, fields }: { form: FormMeta; fields: BuilderField[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Selection>({ kind: "header" });

  async function add(type: string) {
    const fd = new FormData();
    fd.append("formId", form.id);
    fd.append("afterId", fields.length ? fields[fields.length - 1].id : "");
    fd.append("fieldType", type);
    const id = await addFieldOfType(fd);
    if (id) setSelected({ kind: "field", id });
    router.refresh();
  }

  const selectedField =
    selected.kind === "field" ? fields.find((f) => f.id === selected.id) : undefined;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      {/* header row */}
      <div className="grid grid-cols-[1fr_1.4fr_1.1fr] border-b border-gray-200 text-sm">
        <div className="border-r border-gray-200 px-4 py-3">
          <p className="font-medium text-gray-900">Add a field</p>
          <p className="text-xs text-gray-400">Click + to add</p>
        </div>
        <div className="border-r border-gray-200 px-4 py-3">
          <p className="font-medium text-gray-900">Form</p>
          <p className="text-xs text-gray-400">Select to edit</p>
        </div>
        <div className="px-4 py-3">
          <p className="font-medium text-gray-900">Settings</p>
          <p className="text-xs text-gray-400">
            {selected.kind === "header" ? "Title & description" : "Selected field"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1.4fr_1.1fr]">
        {/* LEFT: palette */}
        <div className="space-y-3 border-r border-gray-200 p-3">
          {PALETTE.map((g) => (
            <div key={g.group}>
              <p className="mb-1 text-xs text-gray-400">{g.group}</p>
              <div className="space-y-1.5">
                {g.items.map((it) => (
                  <button
                    key={it.value}
                    onClick={() => add(it.value)}
                    className="flex w-full items-center justify-between rounded-md border border-gray-200 px-2.5 py-2 text-left text-xs text-gray-700 hover:border-brand-300 hover:bg-brand-50"
                  >
                    {it.label}
                    <Plus className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* MIDDLE: form preview */}
        <div className="space-y-2 border-r border-gray-200 bg-gray-50 p-4">
          <button
            onClick={() => setSelected({ kind: "header" })}
            className={`block w-full rounded-lg border bg-white p-4 text-left ${
              selected.kind === "header" ? "border-brand-400 ring-1 ring-brand-200" : "border-gray-200"
            }`}
          >
            {form.style.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.style.logo_url} alt="Logo" className="mb-2 h-10 w-auto" />
            )}
            <p
              className={`font-bold ${SIZE_CLASS[form.style.title?.size ?? "2xl"]} ${alignClass(form.style.title?.align)}`}
              style={{ color: form.style.title?.color ?? "#111827" }}
            >
              {form.name === "Untitled form" ? "Untitled form" : form.name}
            </p>
            {form.description && (
              <p
                className={`mt-1 whitespace-pre-wrap ${SIZE_CLASS[form.style.description?.size ?? "sm"]} ${alignClass(form.style.description?.align)}`}
                style={{ color: form.style.description?.color ?? "#374151" }}
              >
                {form.description}
              </p>
            )}
          </button>

          {/* locked name */}
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">Full name</p>
              <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                <Lock className="h-3 w-3" /> Always included
              </span>
            </div>
          </div>

          {fields.map((f) => {
            const isSel = selected.kind === "field" && selected.id === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setSelected({ kind: "field", id: f.id })}
                className={`block w-full rounded-lg border bg-white p-3 text-left ${
                  isSel ? "border-brand-400 ring-1 ring-brand-200" : "border-gray-200"
                }`}
              >
                {f.field_type === "body_text" ? (
                  <p className="text-sm text-gray-600">{f.config?.text || "Body text"}</p>
                ) : (
                  <>
                    <p className="text-sm font-medium text-gray-900">
                      {f.label}
                      {f.required && <span className="ml-1 text-red-500">*</span>}
                    </p>
                    <p className="text-xs text-gray-400">{TYPE_LABEL[f.field_type] ?? f.field_type}</p>
                  </>
                )}
              </button>
            );
          })}

          {fields.length === 0 && (
            <p className="px-1 py-2 text-xs text-gray-400">
              Add fields from the left to build your form.
            </p>
          )}
        </div>

        {/* RIGHT: settings */}
        <div className="p-4">
          {selected.kind === "header" && (
            <FormHeaderEditor
              formId={form.id}
              name={form.name}
              description={form.description}
              style={form.style}
            />
          )}

          {selected.kind === "field" && selectedField && (
            <div className="space-y-4">
              <FieldForm
                formId={form.id}
                defaults={{
                  id: selectedField.id,
                  label: selectedField.label,
                  fieldType: selectedField.field_type,
                  required: selectedField.required,
                  options: selectedField.options ?? [],
                  helpText: selectedField.help_text ?? "",
                  config: selectedField.config ?? null,
                } as FieldDefaults}
              />
              <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
                <form action={moveField}>
                  <input type="hidden" name="id" value={selectedField.id} />
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Move up">
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </form>
                <form action={moveField}>
                  <input type="hidden" name="id" value={selectedField.id} />
                  <input type="hidden" name="formId" value={form.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className="rounded-md border border-gray-300 p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Move down">
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </form>
                <form action={deleteField} className="ml-auto">
                  <input type="hidden" name="id" value={selectedField.id} />
                  <input type="hidden" name="formId" value={form.id} />
                  <button className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs text-gray-600 hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              </div>
            </div>
          )}

          {selected.kind === "field" && !selectedField && (
            <p className="text-sm text-gray-500">Select a field to edit it.</p>
          )}
        </div>
      </div>
    </div>
  );
}
