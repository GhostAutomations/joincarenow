"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mail, MessageSquare, StickyNote, Send, MessagesSquare, Sparkles } from "lucide-react";
import {
  getApplicantThread,
  sendMessage,
  addNote,
  type Msg,
  type ThreadTemplate,
} from "@/modules/comms/actions";
import { cleanMessageBody } from "@/lib/comms/clean";
import { createClient } from "@/lib/supabase/client";

const cls =
  "block w-full rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type Channel = "email" | "sms" | "note";
type Filter = "all" | "email" | "sms" | "portal";

const CH_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  portal: <MessagesSquare className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
};
// Per-message channel label (so an in-app portal message is never mistaken for a
// charged SMS).
const CH_LABEL: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  portal: "Portal",
  note: "Note",
};

export function ApplicantComms({
  applicationId,
  email,
  phone,
}: {
  applicationId: string;
  email: string | null;
  phone: string | null;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [templates, setTemplates] = useState<ThreadTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [channel, setChannel] = useState<Channel>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const t = await getApplicantThread(applicationId);
    setMessages(t.messages);
    setTemplates(t.templates);
    setLoading(false);
  }, [applicationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: refetch the thread whenever messages change (Poppy posts, the
  // applicant replies, a send completes). RLS scopes events to this company; the
  // refetch is scoped to this application. Slow poll as a socket-drop safety net.
  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => load(), 400);
    };
    const channel = supabase
      .channel(`applicant-comms-${applicationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, bump)
      .subscribe();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 60000);
    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [applicationId, load]);

  function applyTemplate(id: string) {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setSubject(t.subject ?? "");
    setBody(t.body);
  }

  async function submit() {
    setError(null);
    if (!body.trim()) {
      setError("Write a message first");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("body", body);
    let res;
    if (channel === "note") {
      res = await addNote(undefined, fd);
    } else {
      fd.set("channel", channel);
      fd.set("subject", subject);
      res = await sendMessage(undefined, fd);
    }
    setBusy(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setBody("");
    setSubject("");
    await load();
  }

  const channelTemplates = templates.filter((t) => t.channel === channel);
  const canSend =
    channel === "note" || (channel === "email" ? !!email : !!phone);

  // Inbox view filter. "All" shows everything (incl. internal notes);
  // Email/SMS/Portal narrow to that channel only.
  const visible = messages.filter((m) =>
    filter === "all" ? true : m.channel === filter
  );

  // Keep the conversation pinned to the latest message (newest is at the bottom).
  useEffect(() => {
    const el = listRef.current;
    if (el && !loading) el.scrollTop = el.scrollHeight;
  }, [visible.length, filter, loading]);

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "email", label: "Email" },
    { key: "sms", label: "SMS" },
    { key: "portal", label: "Portal" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Inbox header + channel filter */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <MessagesSquare className="h-4 w-4 text-gray-400" /> Conversation
        </p>
        <div className="inline-flex rounded-md border border-white/40 p-0.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded px-2.5 py-1 font-medium ${
                filter === f.key ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-white/70"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message list (scrolls) */}
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            {messages.length === 0 ? "No messages yet." : filter === "all" ? "No messages yet." : `No ${CH_LABEL[filter] ?? filter} messages.`}
          </p>
        ) : (
          visible.map((m) => {
            // Internal notes are centred and clearly staff-only.
            if (m.channel === "note") {
              return (
                <div key={m.id} className="flex justify-center">
                  <div className="max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
                    <span className="font-medium">Internal note</span> · {m.body}
                  </div>
                </div>
              );
            }
            const inbound = m.direction === "inbound";
            // Strip greeting/sign-off from our outbound messages so it reads as chat.
            const text = inbound ? m.body : cleanMessageBody(m.body);
            return (
              <div key={m.id} className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${inbound ? "rounded-bl-sm border border-gray-200 bg-white text-gray-800" : "rounded-br-sm bg-brand-600 text-white"}`}>
                  <p className="whitespace-pre-wrap break-words">{text}</p>
                  <p className={`mt-1 flex items-center gap-1 text-[10px] ${inbound ? "text-gray-400" : "text-white/70"}`}>
                    {m.from_poppy ? <Sparkles className="h-3.5 w-3.5" /> : CH_ICON[m.channel]}
                    {m.from_poppy ? "Poppy" : (CH_LABEL[m.channel] ?? m.channel)} · {new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                    {!inbound && m.status === "failed" && <span className="text-red-200">· failed</span>}
                  </p>
                  {m.error && !inbound && <p className="mt-0.5 text-[10px] text-red-200">{m.error}</p>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer (pinned at bottom) */}
      <div className="shrink-0 space-y-2 border-t border-gray-200 bg-gray-50/60 px-4 py-3">
        <div className="inline-flex rounded-md border border-white/40 bg-white p-0.5 text-xs">
          {(["email", "sms", "note"] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex items-center gap-1 rounded px-2 py-1 capitalize ${
                channel === c ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-white/70"
              }`}
            >
              {CH_ICON[c]} {c}
            </button>
          ))}
        </div>

        {channel !== "note" && channelTemplates.length > 0 && (
          <select defaultValue="" onChange={(e) => applyTemplate(e.target.value)} className={`${cls} bg-white`}>
            <option value="">Use a template…</option>
            {channelTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {channel === "email" && (
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className={`${cls} bg-white`}
          />
        )}

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={channel === "note" ? 2 : 3}
          placeholder={channel === "note" ? "Add an internal note…" : "Write your message…"}
          className={`${cls} bg-white`}
        />

        {error && <p className="text-xs text-red-600">{error}</p>}
        {!canSend && (
          <p className="text-xs text-amber-600">
            No {channel === "email" ? "email address" : "phone number"} on file for this applicant.
          </p>
        )}

        <button
          onClick={submit}
          disabled={busy || !canSend}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {busy ? "Sending…" : channel === "note" ? "Add note" : `Send ${channel}`}
        </button>
      </div>
    </div>
  );
}
