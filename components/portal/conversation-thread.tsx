"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { postApplicantReply, type PortalReplyState } from "@/modules/portal/actions";

export type ChatMessage = { id: string; mine: boolean; body: string; at: string };

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ConversationThread({
  applicationId,
  companyName,
  messages,
}: {
  applicationId: string;
  companyName: string;
  messages: ChatMessage[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState<PortalReplyState, FormData>(postApplicantReply, undefined);

  useEffect(() => {
    if (state?.ok) { formRef.current?.reset(); router.refresh(); }
  }, [state, router]);

  // Always show the latest message — jump the chat container to the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="flex h-[70vh] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">{companyName}</p>
        <p className="text-xs text-gray-400">Messages with the recruitment team</p>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-400">No messages yet.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${m.mine ? "rounded-br-sm bg-brand-600 text-white" : "rounded-bl-sm bg-white text-gray-800 border border-gray-200"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-white/70" : "text-gray-400"}`}>{timeLabel(m.at)}</p>
            </div>
          </div>
        ))}
      </div>

      <form ref={formRef} action={action} className="flex items-end gap-2 border-t border-gray-100 p-3">
        <input type="hidden" name="applicationId" value={applicationId} />
        <textarea
          name="body"
          rows={1}
          placeholder="Type a message…"
          className="max-h-32 min-h-[40px] flex-1 resize-none rounded-xl border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <button type="submit" disabled={pending} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60">
          <Send className="h-4 w-4" />
        </button>
      </form>
      {state?.error && <p className="px-4 pb-2 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
