"use client";

import { useState, useTransition } from "react";
import { Link2, Link2Off } from "lucide-react";
import { setFieldLinkEnabled, setFieldParent } from "@/modules/forms/actions";
import type { BuilderField } from "@/components/dashboard/jcn-form-builder";

const CHOICE = ["dropdown", "radio", "checkboxes", "yes_no"];
const answersFor = (f: BuilderField): string[] =>
  f.field_type === "yes_no" ? ["Yes", "No"] : f.options ?? [];

/** "Link" checkbox (marks a question as a trigger) + "Link to" selector (makes
 *  this field follow another question's answer). Reuses parent_field_id/value. */
export function FieldLinkControls({
  field,
  allFields,
  formId,
  onPatch,
}: {
  field: BuilderField;
  allFields: BuilderField[];
  formId: string;
  onPatch: (patch: Partial<BuilderField>) => void;
}) {
  const [, start] = useTransition();
  const [selQ, setSelQ] = useState("");

  const isChoice = CHOICE.includes(field.field_type);
  const linkEnabled = !!(field.config as { link?: boolean } | null)?.link;
  const byId = new Map(allFields.map((f) => [f.id, f]));
  const linkable = allFields.filter(
    (q) => q.id !== field.id && (q.config as { link?: boolean } | null)?.link === true
  );
  const parent = field.parent_field_id ? byId.get(field.parent_field_id) : null;

  function toggleLink(checked: boolean) {
    onPatch({ config: { ...(field.config ?? {}), link: checked } });
    const fd = new FormData();
    fd.append("id", field.id);
    fd.append("formId", formId);
    fd.append("enabled", checked.toString());
    start(() => void setFieldLinkEnabled(fd));
  }

  function applyLink(parentFieldId: string | null, parentValue: string | null) {
    onPatch({ parent_field_id: parentFieldId, parent_value: parentValue });
    const fd = new FormData();
    fd.append("id", field.id);
    fd.append("formId", formId);
    if (parentFieldId) fd.append("parentFieldId", parentFieldId);
    if (parentValue) fd.append("parentValue", parentValue);
    start(() => void setFieldParent(fd));
  }

  const sel = "rounded-md border border-white/40 px-2 py-1 text-xs focus:border-brand-500 focus:outline-none";

  return (
    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      {isChoice && (
        <label className="flex items-start gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={linkEnabled}
            onChange={(e) => toggleLink(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/40 text-brand-600"
          />
          <span>
            <span className="font-medium text-gray-800">Link</span> — let other questions follow on from this question&apos;s answer.
          </span>
        </label>
      )}

      <div>
        <p className="flex items-center gap-1.5 text-xs font-medium text-gray-600">
          <Link2 className="h-3.5 w-3.5" /> Link to
        </p>
        {field.parent_field_id ? (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-brand-50 px-2 py-1 text-brand-700">
              Shows when “{parent?.label || "a question"}” = “{field.parent_value}”
            </span>
            <button
              type="button"
              onClick={() => { setSelQ(""); applyLink(null, null); }}
              className="inline-flex items-center gap-1 text-gray-500 hover:text-red-600"
            >
              <Link2Off className="h-3.5 w-3.5" /> Unlink
            </button>
          </div>
        ) : linkable.length === 0 ? (
          <p className="mt-1 text-xs text-gray-400">
            Tick “Link” on a Yes/No or choice question first, then link this field to it.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap gap-2">
            <select value={selQ} onChange={(e) => setSelQ(e.target.value)} className={sel}>
              <option value="">Select a question…</option>
              {linkable.map((q) => (
                <option key={q.id} value={q.id}>{q.label || "Untitled question"}</option>
              ))}
            </select>
            {selQ && (
              <select
                value=""
                onChange={(e) => e.target.value && applyLink(selQ, e.target.value)}
                className={sel}
              >
                <option value="">When the answer is…</option>
                {answersFor(byId.get(selQ) as BuilderField).map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
