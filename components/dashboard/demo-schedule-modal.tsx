"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, CalendarClock } from "lucide-react";
import { scheduleDemo, getProspectContacts, type ProspectState } from "@/modules/prospects/actions";
import { DemoDateTime } from "@/components/dashboard/demo-datetime";

type Contact = { id: string; name: string | null; email: string | null };

/** Popup shown when a card is dragged to Demo booked — book the demo (which
 *  sends the calendar invite and moves the card) or cancel (no change). */
export function DemoScheduleModal({ prospectId, name, onClose }: { prospectId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [state, action, pending] = useActionState<ProspectState, FormData>(scheduleDemo, undefined);

  useEffect(() => {
    getProspectContacts(prospectId).then(setContacts);
  }, [prospectId]);

  useEffect(() => {
    if (state?.ok) {
      onClose();
      router.refresh();
    }
  }, [state, onClose, router]);

  const emailable = (contacts ?? []).filter((c) => c.email);
  const field = "rounded-lg border border-white/40 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Book a demo">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Book a demo — {name}</h3>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {contacts === null ? (
          <p className="mt-4 text-sm text-gray-500">Loading contacts…</p>
        ) : emailable.length === 0 ? (
          <p className="mt-4 text-sm text-gray-600">This prospect has no contact with an email. Add one first, then book the demo.</p>
        ) : (
          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={prospectId} />
            <label className="block text-sm font-medium text-gray-700">
              Contact
              <select name="contactId" defaultValue={emailable[0].id} className={`mt-1 block w-full ${field}`}>
                {emailable.map((c) => <option key={c.id} value={c.id}>{c.name || c.email}</option>)}
              </select>
            </label>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date &amp; time</label>
              <div className="mt-1"><DemoDateTime name="at" /></div>
            </div>
            <label className="block text-sm font-medium text-gray-700">
              Length
              <select name="duration" defaultValue="30" className={`mt-1 block ${field}`}>
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
            </label>
            {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={onClose} className="rounded-lg border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white/60">Cancel</button>
              <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
                <CalendarClock className="h-4 w-4" /> {pending ? "Booking…" : "Book & send invite"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
