"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { draftWithAi, type ProspectState } from "@/modules/prospects/actions";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; opted_out: boolean };

export function ProspectAiDraft({ companyId, contacts }: { companyId: string; contacts: Contact[] }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [state, action] = useActionState<ProspectState, FormData>(draftWithAi, undefined);

  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);

  const reachable = contacts.filter((c) => !c.opted_out && (channel === "email" ? c.email : c.phone));

  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 p-3">
      <input type="hidden" name="id" value={companyId} />
      <input type="hidden" name="channel" value={channel} />
      <Sparkles className="h-4 w-4 text-violet-600" />
      <span className="text-sm font-medium text-violet-900">Draft with AI</span>
      <select
        onChange={(e) => setChannel(e.target.value as "email" | "sms")}
        value={channel}
        className="rounded-lg border border-white/40 px-2 py-1.5 text-sm"
      >
        <option value="email">Email</option>
        <option value="sms">SMS</option>
      </select>
      <select name="contactId" defaultValue="" className="rounded-lg border border-white/40 px-2 py-1.5 text-sm">
        <option value="" disabled>Contact…</option>
        {reachable.map((c) => (
          <option key={c.id} value={c.id}>{c.name || (channel === "email" ? c.email : c.phone)}</option>
        ))}
      </select>
      <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700">
        Draft
      </button>
      <span className="text-xs text-violet-700">Goes to Needs approval — nothing sends until you approve.</span>
      {state?.ok && <span className="text-xs font-medium text-green-700">Draft ready in approvals.</span>}
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
