"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addTemplateTask, type OnbState } from "@/modules/onboarding/actions";

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function AddTemplateTask({ forms }: { forms: { id: string; name: string }[] }) {
  const [state, action] = useActionState<OnbState, FormData>(addTemplateTask, undefined);
  const [type, setType] = useState("document");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setType("document");
    }
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      {state?.error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{state.error}</p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Workflow title
          <input name="title" placeholder="e.g. Right to Work check" className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Type
          <select name="taskType" value={type} onChange={(e) => setType(e.target.value)} className={cls}>
            <option value="document">Upload a document</option>
            <option value="form">Fill in a form</option>
            <option value="acknowledge">Read &amp; confirm</option>
          </select>
        </label>
      </div>

      {type === "form" && (
        <label className="block text-xs font-medium text-gray-600">
          Form(s) to complete
          <select name="formId" multiple className={`${cls} h-auto min-h-[6rem]`}>
            {forms.map((f) => (
              <option key={f.id} value={f.id} className="py-0.5">{f.name}</option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] font-normal text-gray-400">
            Hold {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"} to select more than one. Each becomes its own task.
          </span>
        </label>
      )}

      <label className="block text-xs font-medium text-gray-600">
        Send this to the applicant when…
        <select name="triggerStage" defaultValue="" className={cls}>
          <option value="" disabled>Select one…</option>
          <option value="on_application">They submit their application</option>
          <option value="reviewing">They reach Reviewing</option>
          <option value="interview">They reach Interview</option>
          <option value="offer">They reach Offer</option>
          <option value="hired">They are Hired</option>
        </select>
      </label>

      <label className="block text-xs font-medium text-gray-600">
        {type === "acknowledge" ? "Text to read & confirm" : "Instructions (optional)"}
        <textarea name="body" rows={2} className={cls} />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Due within (days)
          <input name="dueDays" type="number" min="0" placeholder="e.g. 7" className={cls} />
        </label>
        <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="required" defaultChecked className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          Required
        </label>
      </div>

      <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        Add to checklist
      </button>
    </form>
  );
}
