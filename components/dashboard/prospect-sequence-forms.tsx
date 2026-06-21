"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createSequence, addStep, type SeqState } from "@/modules/prospects/sequence-actions";

const input = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function SequenceCreateForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<SeqState, FormData>(createSequence, undefined);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); router.refresh(); } }, [state, router]);

  return (
    <form ref={ref} action={action} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h2 className="text-sm font-semibold text-gray-900">New sequence</h2>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1 text-xs font-medium text-gray-600">
          Name
          <input name="name" placeholder="e.g. Domiciliary cold outreach" className={input} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Channel
          <select name="channel" className={input} defaultValue="email">
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="auto_send" defaultChecked className="h-4 w-4 rounded border-gray-300" />
          Auto-send
        </label>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Create</button>
      </div>
      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}

export function SequenceStepForm({ sequenceId }: { sequenceId: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<SeqState, FormData>(addStep, undefined);
  useEffect(() => { if (state?.ok) { ref.current?.reset(); router.refresh(); } }, [state, router]);

  return (
    <form ref={ref} action={action} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
      <input type="hidden" name="sequenceId" value={sequenceId} />
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs font-medium text-gray-600">
          Wait (days)
          <input name="delay_days" type="number" min="0" defaultValue="0" className={`${input} w-24`} />
        </label>
        <label className="min-w-[180px] flex-1 text-xs font-medium text-gray-600">
          Subject (email)
          <input name="subject" className={input} />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input type="checkbox" name="high_risk" className="h-4 w-4 rounded border-gray-300" />
          Needs approval
        </label>
      </div>
      <textarea name="body" rows={3} placeholder="Message… ({{first_name}}, {{company_name}})" className={`${input} font-mono text-xs`} />
      <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">Add step</button>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
