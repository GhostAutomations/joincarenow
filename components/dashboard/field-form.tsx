"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { addField, updateField } from "@/modules/forms/actions";

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
  "mt-1 block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

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
  onPatch,
}: {
  formId: string;
  defaults?: FieldDefaults;
  onSaved?: () => void;
  /** Report edits back to the builder so the outline/canvas update live. */
  onPatch?: (patch: {
    label: string;
    field_type: string;
    required: boolean;
    options: string[];
    help_text: string | null;
    config: { text?: string; size?: string; color?: string } | null;
  }) => void;
}) {
  const isEdit = !!defaults;
  const router = useRouter();

  const [label, setLabel] = useState(defaults?.label ?? "");
  const [type, setType] = useState(defaults?.fieldType ?? "short_text");
  const [required, setRequired] = useState(defaults?.required ?? false);
  const [helpText, setHelpText] = useState(defaults?.helpText ?? "");
  const [options, setOptions] = useState<string[]>(
    defaults?.options?.length ? defaults.options : ["Option 1"]
  );
  const [content, setContent] = useState(defaults?.config?.text ?? "");
  const [size, setSize] = useState(defaults?.config?.size ?? "normal");
  const [color, setColor] = useState(defaults?.config?.color ?? "#374151");
  const [error, setError] = useState<string | null>(null);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  function buildFD(): FormData {
    const fd = new FormData();
    fd.append("formId", formId);
    if (defaults) fd.append("id", defaults.id);
    fd.append("fieldType", type);
    fd.append("label", label);
    if (required) fd.append("required", "on");
    fd.append("helpText", helpText);
    fd.append("options", options.join("\n"));
    fd.append("content", content);
    fd.append("fontSize", size);
    fd.append("fontColor", color);
    return fd;
  }

  // Edit mode: debounced programmatic save (no form submit → no value loss).
  useEffect(() => {
    if (!isEdit) return;
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const res = await updateField(undefined, buildFD());
      if (res?.error) setError(res.error);
      else {
        setError(null);
        // Update the builder's local copy so the outline/canvas reflect the
        // edit immediately — no full refresh (which caused the page to jump).
        onPatch?.({
          label,
          field_type: type,
          required,
          options,
          help_text: helpText || null,
          config: isBody ? { text: content, size, color } : null,
        });
      }
    }, 600);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label, type, required, helpText, options, content, size, color]);

  async function addNew() {
    const res = await addField(undefined, buildFD());
    if (res?.error) {
      setError(res.error);
      return;
    }
    setError(null);
    setLabel("");
    setType("short_text");
    setRequired(false);
    setHelpText("");
    setOptions(["Option 1"]);
    setContent("");
    router.refresh();
  }

  const isBody = type === "body_text";

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          {isBody ? "Heading (optional)" : "Question / label"}
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Untitled question"
            className={cls}
          />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Field type
          <select value={type} onChange={(e) => setType(e.target.value)} className={cls}>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </label>
      </div>

      {isBody ? (
        <>
          <label className="block text-xs font-medium text-gray-600">
            Text to display
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Explain what's needed in this section…"
              className={cls}
            />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Font size
              <select value={size} onChange={(e) => setSize(e.target.value)} className={cls}>
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
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="mt-1 block h-9 w-16 rounded-md border border-white/40"
              />
            </label>
          </div>
        </>
      ) : (
        <>
          {CHOICE.includes(type) && (
            <OptionsEditor type={type} options={options} setOptions={setOptions} />
          )}

          <label className="block text-xs font-medium text-gray-600">
            Help text (optional)
            <input value={helpText} onChange={(e) => setHelpText(e.target.value)} className={cls} />
          </label>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
            />
            Required
          </label>
        </>
      )}

      {isEdit ? (
        <p className="text-xs text-gray-400">Changes save automatically.</p>
      ) : (
        <button
          type="button"
          onClick={addNew}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add field
        </button>
      )}
    </div>
  );
}

function OptionsEditor({
  type,
  options,
  setOptions,
}: {
  type: string;
  options: string[];
  setOptions: (fn: (a: string[]) => string[]) => void;
}) {
  const isMulti = type === "checkboxes";
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-gray-600">Options</p>
      <div className="space-y-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-4 w-4 shrink-0 border border-gray-400 ${isMulti ? "rounded-sm" : "rounded-full"}`}
            />
            <input
              value={o}
              onChange={(e) =>
                setOptions((arr) => arr.map((x, idx) => (idx === i ? e.target.value : x)))
              }
              onFocus={(e) => e.currentTarget.select()}
              placeholder={`Option ${i + 1}`}
              className="flex-1 rounded-md border border-white/40 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={() =>
                setOptions((arr) => (arr.length > 1 ? arr.filter((_, idx) => idx !== i) : arr))
              }
              aria-label="Remove option"
              className="rounded p-1 text-gray-400 hover:bg-white/70 hover:text-red-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setOptions((arr) => [...arr, `Option ${arr.length + 1}`])}
        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
    </div>
  );
}
