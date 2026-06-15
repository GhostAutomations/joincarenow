"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addField, updateField, type FormState } from "@/modules/forms/actions";

const TYPES: { value: string; label: string }[] = [
  { value: "short_text", label: "Short text" },
  { value: "long_text", label: "Long text (paragraph)" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "dropdown", label: "Dropdown" },
  { value: "radio", label: "Single select" },
  { value: "checkboxes", label: "Multi select" },
  { value: "yes_no", label: "Yes / No" },
  { value: "file", label: "File upload" },
  { value: "signature", label: "Signature" },
  { value: "address", label: "Address" },
  { value: "body_text", label: "Body text / information" },
];
const CHOICE = ["dropdown", "radio", "checkboxes"];

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export type FieldDefaults = {
  id: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: string[];
  helpText: string;
  config?: { text?: string; size?: string; color?: string } | null;
};

export function FieldForm({
  formId,
  defaults,
}: {
  formId: string;
  defaults?: FieldDefaults;
  onSaved?: () => void;
}) {
  const isEdit = !!defaults;
  const action = isEdit ? updateField : addField;
  const [state, formAction] = useActionState<FormState, FormData>(action, undefined);
  const [type, setType] = useState(defaults?.fieldType ?? "short_text");
  const formRef = useRef<HTMLFormElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (state?.ok && !isEdit) {
      formRef.current?.reset();
      setType("short_text");
      router.refresh();
    }
  }, [state, isEdit, router]);

  // Edit mode auto-saves on any change (no Save button).
  function autosave() {
    if (!isEdit) return;
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      formRef.current?.requestSubmit();
      router.refresh();
    }, 600);
  }

  const isBody = type === "body_text";

  return (
    <form ref={formRef} action={formAction} onChange={autosave} className="space-y-3">
      {state?.error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          {state.error}
        </p>
      )}
      <input type="hidden" name="formId" value={formId} />
      {defaults && <input type="hidden" name="id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          {isBody ? "Heading (optional)" : "Question / label"}
          <input name="label" defaultValue={defaults?.label} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Field type
          <select
            name="fieldType"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className={cls}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isBody ? (
        <>
          <label className="block text-xs font-medium text-gray-600">
            Text to display
            <textarea
              name="content"
              rows={4}
              defaultValue={defaults?.config?.text ?? ""}
              placeholder="Explain what's needed in this section…"
              className={cls}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Font size
              <select
                name="fontSize"
                defaultValue={defaults?.config?.size ?? "normal"}
                className={cls}
              >
                <option value="small">Small</option>
                <option value="normal">Normal</option>
                <option value="large">Large</option>
                <option value="xl">Extra large</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Text colour
              <input
                type="color"
                name="fontColor"
                defaultValue={defaults?.config?.color ?? "#374151"}
                className="mt-1 block h-9 w-16 rounded-md border border-gray-300"
              />
            </label>
          </div>
        </>
      ) : (
        <>
          {CHOICE.includes(type) && (
            <OptionsEditor type={type} defaultOptions={defaults?.options ?? []} />
          )}

          <label className="block text-xs font-medium text-gray-600">
            Help text (optional)
            <input name="helpText" defaultValue={defaults?.helpText} className={cls} />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="required"
              defaultChecked={defaults?.required}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Required
          </label>
        </>
      )}

      {isEdit ? (
        <p className="text-xs text-gray-400">Changes save automatically.</p>
      ) : (
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Add field
        </button>
      )}
    </form>
  );
}

function OptionsEditor({
  type,
  defaultOptions,
}: {
  type: string;
  defaultOptions: string[];
}) {
  const [opts, setOpts] = useState<string[]>(
    defaultOptions.length ? defaultOptions : ["Option 1"]
  );
  const isMulti = type === "checkboxes";

  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-600">Options</p>
      <div className="space-y-2">
        {opts.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 border border-gray-400 ${
                isMulti ? "rounded-sm" : "rounded-full"
              }`}
            />
            <input
              value={o}
              onChange={(e) =>
                setOpts((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))
              }
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() =>
                setOpts((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr))
              }
              aria-label="Remove option"
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOpts((arr) => [...arr, `Option ${arr.length + 1}`])}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
      <input type="hidden" name="options" value={opts.join("\n")} />
    </div>
  );
}
