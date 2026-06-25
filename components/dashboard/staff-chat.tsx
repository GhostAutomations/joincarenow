"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { sendStaffMessage, type StaffMsgState } from "@/modules/staff-messages/actions";

export type StaffChatMessage = { id: string; mine: boolean; body: string; at: string; applicant: string | null };
export type TagOption = { applicationId: string; name: string };

function timeLabel(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function StaffChat({
  recipientId,
  recipientName,
  messages,
  applicants,
}: {
  recipientId: string;
  recipientName: string;
  messages: StaffChatMessage[];
  applicants: TagOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState<StaffMsgState, FormData>(sendStaffMessage, undefined);

  useEffect(() => {
    if (state?.ok) { formRef.current?.reset(); router.refresh(); }
  }, [state, router]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-white/25 bg-white/15 shadow-sm backdrop-blur-md">
      <div className="border-b border-white/15 px-4 py-3">
        <p className="text-sm font-semibold text-white">{recipientName}</p>
        <p className="text-xs text-white/60">Internal — not visible to applicants</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 && <p className="mt-8 text-center text-sm text-white/60">No messages yet — say hello.</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${m.mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-white/90 text-gray-800"}`}>
              {m.applicant && (
                <p className={`mb-0.5 text-[10px] font-semibold ${m.mine ? "text-white/80" : "text-brand-700"}`}>Re: {m.applicant}</p>
              )}
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-white/70" : "text-gray-500"}`}>{timeLabel(m.at)}</p>
            </div>
          </div>
        ))}
      </div>

      <form ref={formRef} action={action} className="space-y-2 border-t border-white/15 p-3">
        <input type="hidden" name="recipientId" value={recipientId} />
        <div className="flex items-end gap-2">
          <select name="applicationId" defaultValue="" className="w-40 shrink-0 rounded-lg border border-white/40 bg-white/85 px-2 py-2 text-xs text-gray-700 focus:border-brand-500 focus:outline-none">
            <option value="">No applicant</option>
            {applicants.map((a) => <option key={a.applicationId} value={a.applicationId}>{a.name}</option>)}
          </select>
          <textarea
            name="body"
            rows={1}
            placeholder="Type a message…"
            className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/40 bg-white/85 px-3 py-2 text-sm text-gray-800 placeholder-gray-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button type="submit" disabled={pending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-white/60">Tag an applicant to add this to their audit trail (staff-only).</p>
        {state?.error && <p className="text-xs text-red-200">{state.error}</p>}
      </form>
    </div>
  );
}
