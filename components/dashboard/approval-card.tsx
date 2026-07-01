"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { approveDraft, discardDraft } from "@/modules/prospects/approval-actions";

const input = "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export type Draft = {
  id: string;
  companyName: string;
  companyId: string;
  contactLabel: string;
  channel: string;
  subject: string | null;
  body: string;
  highRisk: boolean;
  createdAt: string;
};

export function ApprovalCard({ draft }: { draft: Draft }) {
  const router = useRouter();
  const [subject, setSubject] = useState(draft.subject ?? "");
  const [body, setBody] = useState(draft.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function approve() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("draftId", draft.id);
    fd.set("subject", subject);
    fd.set("body", body);
    const r = await approveDraft(fd);
    setBusy(false);
    if (r?.error) return setError(r.error);
    router.refresh();
  }

  async function discard() {
    setBusy(true); setError(null);
    const fd = new FormData();
    fd.set("draftId", draft.id);
    await discardDraft(fd);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="font-medium text-gray-700">{draft.companyName}</span>
        <span>· {draft.contactLabel}</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 capitalize">{draft.channel}</span>
        {draft.highRisk && <span className="rounded-full bg-red-100 px-2 py-0.5 font-medium text-red-700">price/compliance — review carefully</span>}
        <span className="ml-auto">{new Date(draft.createdAt).toLocaleString("en-GB")}</span>
      </div>
      {draft.channel === "email" && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={input} />
      )}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={`${input} font-mono text-xs`} />
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex items-center gap-2">
        <button onClick={approve} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60">
          <Check className="h-4 w-4" /> {busy ? "Sending…" : "Approve & send"}
        </button>
        <button onClick={discard} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/60 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-white/70 disabled:opacity-60">
          <X className="h-4 w-4" /> Discard
        </button>
      </div>
    </div>
  );
}
