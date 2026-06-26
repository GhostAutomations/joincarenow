"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles } from "lucide-react";
import { generateFormFromBrief, type ImportState } from "@/modules/forms/actions";

function SubmitBtn({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <Sparkles className="h-4 w-4" />
      {pending ? "Generating…" : "Generate with AI"}
    </button>
  );
}

const EXAMPLES = [
  "Supervision & appraisal form for a care assistant",
  "Reference request for a previous employer",
  "Medication competency assessment",
  "Return-to-work interview after sickness absence",
];

export function FormAiGenerate({ formId }: { formId: string }) {
  const [state, action] = useActionState<ImportState, FormData>(generateFormFromBrief, undefined);
  const [brief, setBrief] = useState("");

  useEffect(() => {
    if (state?.added) {
      setBrief("");
      // Jump to the builder so the new questions are visible to review/edit.
      window.location.assign(`${window.location.pathname}?view=builder`);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="formId" value={formId} />
      <p className="text-sm text-gray-500">
        Describe the form you need and AI will draft the questions for you to review and edit.
      </p>
      <textarea
        name="brief"
        required
        rows={3}
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        placeholder="e.g. A supervision form for care assistants covering wellbeing, training needs, concerns and goals."
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setBrief(ex)}
            className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 hover:border-brand-300 hover:text-brand-700"
          >
            {ex}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <SubmitBtn disabled={brief.trim().length < 3} />
        {state?.added ? (
          <span className="text-sm text-green-700">Added {state.added} question{state.added === 1 ? "" : "s"}.</span>
        ) : state?.error ? (
          <span className="text-sm text-red-600">{state.error}</span>
        ) : (
          <span className="text-xs text-gray-400">Takes around a minute.</span>
        )}
      </div>
    </form>
  );
}
