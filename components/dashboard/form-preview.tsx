"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { DynamicField, type FormField } from "@/components/careers/apply-form";

type FormMeta = {
  name: string;
  description: string;
  style: {
    title?: { color?: string; size?: string; align?: string };
    description?: { color?: string; size?: string; align?: string };
    logo_url?: string;
  };
};

const SIZE_CLASS: Record<string, string> = {
  sm: "text-sm", base: "text-base", lg: "text-lg", xl: "text-xl", "2xl": "text-2xl", "3xl": "text-3xl",
};
const alignCls = (a?: string) =>
  a === "center" ? "text-center" : a === "right" ? "text-right" : "text-left";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** A read-only-ish preview of the form, exactly as an applicant sees it
 *  (built-in basics + custom fields + conditional logic). Shown in a modal. */
export function FormPreview({
  form,
  fields,
  onClose,
}: {
  form: FormMeta;
  fields: FormField[];
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  function track(e: { target: EventTarget | null }) {
    const t = e.target as HTMLInputElement;
    const name = t?.name;
    if (!name || !name.startsWith("field_")) return;
    const id = name.slice("field_".length);
    if (t.type === "checkbox") {
      setAnswers((a) => {
        const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
        const next = t.checked ? [...cur, t.value] : cur.filter((v) => v !== t.value);
        return { ...a, [id]: next };
      });
    } else {
      setAnswers((a) => ({ ...a, [id]: t.value }));
    }
  }

  function visible(f: FormField) {
    if (!f.parent_field_id) return true;
    const v = answers[f.parent_field_id];
    if (v == null) return false;
    return Array.isArray(v) ? v.includes(f.parent_value ?? "") : v === f.parent_value;
  }

  const ts = form.style.title;
  const ds = form.style.description;

  return (
    <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 h-max w-full max-w-2xl rounded-xl bg-white p-6 sm:p-8">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400">
            Preview
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {form.style.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.style.logo_url} alt="Logo" className="mb-3 h-12 w-auto" />
        )}
        <h2
          className={`font-bold ${SIZE_CLASS[ts?.size ?? "2xl"]} ${alignCls(ts?.align)}`}
          style={{ color: ts?.color ?? "#111827" }}
        >
          {form.name === "Untitled form" ? "Untitled form" : form.name}
        </h2>
        {form.description && (
          <p
            className={`mt-1 whitespace-pre-wrap ${SIZE_CLASS[ds?.size ?? "sm"]} ${alignCls(ds?.align)}`}
            style={{ color: ds?.color ?? "#374151" }}
          >
            {form.description}
          </p>
        )}

        <form onChange={track} className="mt-6 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium text-gray-700">
              First name
              <input className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Last name
              <input className={inputClass} />
            </label>
          </div>

          {fields.filter(visible).map((f) =>
            f.field_type === "page_break" ? (
              <div key={f.field_id} className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="text-xs uppercase tracking-wide text-gray-400">New page</span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>
            ) : (
              <DynamicField key={f.field_id} field={f} />
            )
          )}

          <div className="sm:w-48">
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white opacity-70"
            >
              Submit application
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
