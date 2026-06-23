"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { sendProposal, getProspectContacts, type ProspectState } from "@/modules/prospects/actions";

type Contact = { id: string; name: string | null; email: string | null };

function defaultProposal(firstName: string): string {
  return (
    `Hi ${firstName},\n\n` +
    `Thanks for taking the time to look at Join Care Now. Here's a simple proposal.\n\n` +
    `One plan, everything included — recruitment, onboarding and compliance in one place. Three ways to pay:\n\n` +
    `• Monthly — £55/month, cancel anytime (£150 one-off setup)\n` +
    `• 12-month plan — £55/month, no setup fee\n` +
    `• Annual — £550/year (2 months free), no setup fee\n\n` +
    `Included on every plan: every feature, core compliance (Right to Work, DBS, references), 1 branch and 100 SMS a month. ` +
    `Add-ons as you grow: extra branches £7.50/mo, SMS 8p after your 100, AI actions 10p each.\n\n` +
    `Happy to answer anything or get you started — just reply to this email.\n\nThe Join Care Now team`
  );
}

export function ProposalModal({ prospectId, name, onClose }: { prospectId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [message, setMessage] = useState("");
  const [state, action, pending] = useActionState<ProspectState, FormData>(sendProposal, undefined);

  useEffect(() => {
    getProspectContacts(prospectId).then((cs) => {
      setContacts(cs);
      const first = cs.find((c) => c.email);
      const fn = (first?.name ?? "").split(" ")[0] || "there";
      setMessage(defaultProposal(fn));
    });
  }, [prospectId]);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  const emailable = (contacts ?? []).filter((c) => c.email);
  const field = "rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Create a proposal">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Create a proposal — {name}</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {contacts === null ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : emailable.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">This prospect has no contact with an email. Add one first.</p>
        ) : (
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={prospectId} />
            <label className="block text-sm font-medium text-gray-700">
              To
              <select name="contactId" defaultValue={emailable[0].id} className={`mt-1 block w-full ${field}`}>
                {emailable.map((c) => <option key={c.id} value={c.id}>{c.name || c.email} ({c.email})</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Subject
              <input name="subject" defaultValue="Your Join Care Now proposal" className={`mt-1 block w-full ${field}`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Message
              <textarea name="message" rows={12} value={message} onChange={(e) => setMessage(e.target.value)} className={`mt-1 block w-full ${field} font-mono text-xs`} />
            </label>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
                <Send className="h-4 w-4" /> {pending ? "Sending…" : "Send proposal"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
