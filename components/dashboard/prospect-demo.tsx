"use client";

import { useActionState } from "react";
import { CalendarClock } from "lucide-react";
import { scheduleDemo, type ProspectState } from "@/modules/prospects/actions";
import { DateTimePicker } from "@/components/ui/datetime-picker";

type Contact = { id: string; name: string | null; email: string | null };

export function ProspectDemo({
  prospectId,
  contacts,
  demoAt,
}: {
  prospectId: string;
  contacts: Contact[];
  demoAt: string | null;
}) {
  const [state, action] = useActionState<ProspectState, FormData>(scheduleDemo, undefined);
  const emailable = contacts.filter((c) => c.email);
  const sel = "rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
      <h2 className="text-sm font-semibold text-gray-900">Book a demo</h2>
      {demoAt && (
        <p className="mt-1 text-sm text-gray-700">
          Currently booked for{" "}
          {new Date(demoAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
        </p>
      )}
      {emailable.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">Add a contact with an email to book a demo.</p>
      ) : (
        <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={prospectId} />
          <select name="contactId" defaultValue="" className={sel} required>
            <option value="" disabled>Contact…</option>
            {emailable.map((c) => (
              <option key={c.id} value={c.id}>{c.name || c.email}</option>
            ))}
          </select>
          <DateTimePicker name="at" minToday />
          <select name="duration" defaultValue="30" className={sel}>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">60 min</option>
          </select>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            <CalendarClock className="h-4 w-4" /> Book & send invite
          </button>
          {state?.ok && <span className="text-sm text-green-700">Booked — calendar invite sent.</span>}
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        </form>
      )}
      <p className="mt-2 text-xs text-gray-400">Sends a calendar invite with your demo video link (set it in Sales → Settings) and moves the card to Demo booked.</p>
    </section>
  );
}
