"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { sendProposal, getProspectContacts, type ProspectState } from "@/modules/prospects/actions";

type Contact = { id: string; name: string | null; email: string | null };

type Plan = "monthly" | "commit" | "annual";

const PLAN_OPTIONS: { value: Plan; label: string }[] = [
  { value: "monthly", label: "Monthly — £55/mo, cancel anytime (£150 setup)" },
  { value: "commit", label: "12-month plan — £55/mo, no setup fee" },
  { value: "annual", label: "Annual — £550/year (2 months free), no setup" },
];

const PLAN_LINE: Record<Plan, string> = {
  monthly: "the Monthly plan — £55 a month, cancel anytime, with a one-off £150 setup fee.",
  commit: "the 12-month plan — £55 a month on a 12-month term, with no setup fee.",
  annual: "the Annual plan — £550 for the year (two months free), with no setup fee.",
};

const OFFER_PRESETS = ["1 month free", "2 months free", "3 months free", "+100 SMS a month", "+200 SMS a month"];

function planProposal(firstName: string, plan: Plan, offer: string): string {
  const offerLine = offer.trim()
    ? `As a thank-you for coming on board, we'll also include: ${offer.trim()}.\n\n`
    : "";
  return (
    `Hi ${firstName},\n\n` +
    `Thanks for taking the time to look at Join Care Now. As discussed, here's the proposal.\n\n` +
    `You'd be on ${PLAN_LINE[plan]}\n\n` +
    offerLine +
    `Everything is included — recruitment, onboarding and compliance (Right to Work, DBS, references) in one place, ` +
    `plus 1 branch and 100 SMS a month. Add-ons as you grow: extra branches £7.50/mo, SMS 8p after your 100, AI actions 10p each.\n\n` +
    `Happy to answer anything or get you started — just reply to this email.\n\nThe Join Care Now team`
  );
}

export function ProposalModal({ prospectId, name, onClose }: { prospectId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [firstName, setFirstName] = useState("there");
  const [plan, setPlan] = useState<Plan>("monthly");
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const editedRef = useRef(false);
  const [state, action, pending] = useActionState<ProspectState, FormData>(sendProposal, undefined);

  useEffect(() => {
    getProspectContacts(prospectId).then((cs) => {
      setContacts(cs);
      const first = cs.find((c) => c.email);
      const fn = (first?.name ?? "").split(" ")[0] || "there";
      setFirstName(fn);
      setMessage(planProposal(fn, "monthly", ""));
    });
  }, [prospectId]);

  // Switching plan or offer regenerates the body — unless the founder has hand-edited it.
  function changePlan(next: Plan) {
    setPlan(next);
    if (!editedRef.current) setMessage(planProposal(firstName, next, offer));
  }
  function changeOffer(next: string) {
    setOffer(next);
    if (!editedRef.current) setMessage(planProposal(firstName, plan, next));
  }

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
            <input type="hidden" name="plan" value={plan} />
            <input type="hidden" name="offer" value={offer} />
            <label className="block text-sm font-medium text-gray-700">
              To
              <select name="contactId" defaultValue={emailable[0].id} className={`mt-1 block w-full ${field}`}>
                {emailable.map((c) => <option key={c.id} value={c.id}>{c.name || c.email} ({c.email})</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Plan they&apos;ll go on
              <select value={plan} onChange={(e) => changePlan(e.target.value as Plan)} className={`mt-1 block w-full ${field}`}>
                {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </label>
            <div className="block text-sm font-medium text-gray-700">
              Special offer <span className="font-normal text-gray-400">(optional)</span>
              <input
                value={offer}
                onChange={(e) => changeOffer(e.target.value)}
                placeholder="e.g. 3 months free, +100 SMS/mo, £45/mo"
                className={`mt-1 block w-full ${field}`}
              />
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {OFFER_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => changeOffer(offer.trim() === p ? "" : p)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                      offer.trim() === p
                        ? "border-brand-500 bg-brand-50 text-brand-700"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Subject
              <input name="subject" defaultValue="Your Join Care Now proposal" className={`mt-1 block w-full ${field}`} />
            </label>
            <label className="block text-sm font-medium text-gray-700">
              Message
              <textarea
                name="message"
                rows={12}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setEdited(true); editedRef.current = true; }}
                className={`mt-1 block w-full ${field} font-mono text-xs`}
              />
            </label>
            {edited && (
              <button
                type="button"
                onClick={() => { editedRef.current = false; setEdited(false); setMessage(planProposal(firstName, plan, offer)); }}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                Reset to template for this plan
              </button>
            )}
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
