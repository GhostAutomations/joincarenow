"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { savePoppySettings } from "@/modules/poppy/actions";
import { POPPY_FOCUS_OPTIONS, POPPY_ATTRIBUTE_OPTIONS, type PoppyConfig } from "@/lib/poppy/config";

const cls =
  "block w-full rounded-lg border border-white/40 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Company-default configuration for the Poppy screening agent. Admin-only. */
export function PoppySettingsForm({
  documents,
  config,
  usage,
}: {
  /** Selectable reference documents (policies + contracts). */
  documents: { value: string; label: string }[];
  config: PoppyConfig;
  /** This month's Poppy screen usage against the included allowance. */
  usage?: { used: number; included: number } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [documentIds, setDocumentIds] = useState<string[]>(config.documentIds);
  const [focus, setFocus] = useState<string[]>(config.focus);
  const [instructions, setInstructions] = useState(config.instructions);
  const [questionCount, setQuestionCount] = useState(String(config.questionCount || 8));
  const [followUps, setFollowUps] = useState(config.followUps === true);
  const [attributes, setAttributes] = useState<string[]>(config.attributes ?? [...POPPY_ATTRIBUTE_OPTIONS]);
  const [customAttr, setCustomAttr] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleFocus(f: string) {
    setFocus((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));
  }
  function toggleAttr(a: string) {
    setAttributes((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }
  function addCustomAttr() {
    const a = customAttr.trim();
    if (!a) return;
    setAttributes((cur) => (cur.some((x) => x.toLowerCase() === a.toLowerCase()) ? cur : [...cur, a]));
    setCustomAttr("");
  }
  // Custom attributes = anything not in the standard list.
  const customAttrs = attributes.filter((a) => !POPPY_ATTRIBUTE_OPTIONS.includes(a));

  function save() {
    setSaved(false);
    setError(null);
    start(async () => {
      const res = await savePoppySettings({
        documentIds,
        focus,
        instructions,
        questionCount: Math.min(20, Math.max(1, Math.round(Number(questionCount) || 8))),
        followUps,
        attributes,
      });
      if (res.error) setError(res.error);
      else {
        setSaved(true);
        router.refresh();
        window.dispatchEvent(new Event("jcn-section-saved"));
      }
    });
  }

  return (
    <div className="mt-4 space-y-5">
      {usage && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-white/50 bg-white/60 px-3.5 py-2.5 backdrop-blur-sm">
          <span className="text-xs font-medium text-gray-600">Screens this month</span>
          <span className="text-sm font-semibold text-gray-900">
            {usage.used} <span className="font-normal text-gray-400">/ {usage.included} included</span>
            {usage.used > usage.included && <span className="ml-1 text-gray-500">· {usage.used - usage.included} at 75p</span>}
          </span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600">Required attributes</label>
        <p className="mb-2 mt-0.5 text-xs text-gray-500">
          When Poppy compares applicants, these are the attributes it assesses every candidate against.
          Anything missing, unmet or unclear is treated as a gap to probe. All are selected by default —
          untick any that don&apos;t apply, or add your own.
        </p>
        <div className="flex flex-wrap gap-2">
          {POPPY_ATTRIBUTE_OPTIONS.map((a) => {
            const on = attributes.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggleAttr(a)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-white/60 bg-white/70 text-gray-700 backdrop-blur-sm hover:bg-white/90"
                }`}
              >
                {on && <Check className="h-3 w-3" />}
                {a}
              </button>
            );
          })}
          {customAttrs.map((a) => (
            <span
              key={a}
              className="flex items-center gap-1.5 rounded-full border border-brand-600 bg-brand-600 px-3 py-1.5 text-xs font-medium text-white"
            >
              <Check className="h-3 w-3" />
              {a}
              <button
                type="button"
                onClick={() => toggleAttr(a)}
                aria-label={`Remove ${a}`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input
            value={customAttr}
            onChange={(e) => setCustomAttr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomAttr();
              }
            }}
            placeholder="Add a custom attribute…"
            className={`${cls} max-w-xs`}
          />
          <button
            type="button"
            onClick={addCustomAttr}
            disabled={!customAttr.trim()}
            className="inline-flex items-center gap-1 rounded-lg border border-white/50 bg-white/70 px-3 py-2 text-sm font-medium text-gray-700 backdrop-blur-sm hover:bg-white/90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Add
          </button>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Reference documents</label>
        <p className="mb-1.5 mt-0.5 text-xs text-gray-500">
          Policies and contracts Poppy should judge every candidate against. The relevant role&apos;s
          job description is always compared automatically.
        </p>
        <MultiSelect
          options={documents}
          selected={documentIds}
          onChange={setDocumentIds}
          allLabel="No extra documents"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">Focus areas</label>
        <p className="mb-2 mt-0.5 text-xs text-gray-500">
          Nudge Poppy to weigh these more heavily. Leave all off for a balanced review.
        </p>
        <div className="flex flex-wrap gap-2">
          {POPPY_FOCUS_OPTIONS.map((f) => {
            const on = focus.includes(f);
            return (
              <button
                key={f}
                type="button"
                onClick={() => toggleFocus(f)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  on
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-white/60 bg-white/70 text-gray-700 backdrop-blur-sm hover:bg-white/90"
                }`}
              >
                {on && <Check className="h-3 w-3" />}
                {f}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">
          Custom instructions
          <textarea
            rows={4}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Anything specific you want Poppy to check or ask about — e.g. confirm driving licence and access to a car, probe gaps in employment, check availability for weekend shifts."
            className={`mt-1 ${cls}`}
          />
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600">
          Number of questions to ask
          <input
            type="number"
            min={1}
            max={20}
            value={questionCount}
            onChange={(e) => setQuestionCount(e.target.value)}
            className={`mt-1 w-28 ${cls}`}
          />
        </label>
        <p className="mt-1 text-xs text-gray-500">Between 1 and 20. Default is 8.</p>
      </div>

      <div>
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={followUps}
            onChange={(e) => setFollowUps(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/60 text-brand-600 focus:ring-brand-500"
          />
          <span>
            <span className="block text-sm font-medium text-gray-700">Follow-up questions</span>
            <span className="block text-xs text-gray-500">
              After the applicant answers, Poppy reviews their responses and asks any follow-up
              questions worth clarifying. Follow-ups are added to the report.
            </span>
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Poppy settings"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
