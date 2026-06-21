"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { enrolContact, type SeqState } from "@/modules/prospects/sequence-actions";

type Opt = { id: string; label: string };

export function ProspectEnrol({
  companyId,
  sequences,
  contacts,
}: {
  companyId: string;
  sequences: Opt[];
  contacts: Opt[];
}) {
  const router = useRouter();
  const [state, action] = useActionState<SeqState, FormData>(enrolContact, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  if (sequences.length === 0) {
    return <p className="text-xs text-gray-400">No sequences yet. Create one in Sales → Sequences.</p>;
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="companyId" value={companyId} />
      <select name="sequenceId" defaultValue="" className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm">
        <option value="" disabled>Sequence…</option>
        {sequences.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
      </select>
      <select name="contactId" defaultValue="" className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm">
        <option value="" disabled>Contact…</option>
        {contacts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Enrol</button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
