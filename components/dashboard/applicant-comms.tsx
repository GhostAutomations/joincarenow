"use client";

import { useEffect, useState, useCallback } from "react";
import { Mail, MessageSquare, StickyNote, Send, MessagesSquare } from "lucide-react";
import {
  getApplicantThread,
  sendMessage,
  addNote,
  type Msg,
  type ThreadTemplate,
} from "@/modules/comms/actions";

const cls =
  "block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type Channel = "email" | "sms" | "note";
type Filter = "both" | "email" | "sms";

const CH_ICON: Record<string, React.ReactNode> = {
  email: <Mail className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  note: <StickyNote className="h-3.5 w-3.5" />,
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
  const [filter, setFilter] = useState<Filter>("both");
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

  // Inbox view filter. "Both" shows everything (incl. internal notes);
  // Email/SMS narrow to that channel only.
  const visible = messages.filter((m) =>
    filter === "both" ? true : m.channel === filter
  );

  const FILTERS: { key: Filter; label: string }[] = [
    { key: "both", label: "Both" },
    { key: "email", label: "Email" },
    { key: "sms", label: "SMS" },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Inbox header + channel filter */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-gray-900">
          <MessagesSquare className="h-4 w-4 text-gray-400" /> Conversation
        </p>
        <div className="inline-flex rounded-md border border-gray-300 p-0.5 text-xs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded px-2.5 py-1 font-medium ${
                filter === f.key ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message list (scrolls) */}
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-gray-500">
            {messages.length === 0 ? "No messages yet." : `No ${filter} messages.`}
          </p>
        ) : (
          visible.map((m) => {
            const inbound = m.direction === "inbound";
            return (
              <div
                key={m.id}
                className={`rounded-lg border p-3 ${
                  inbound ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"
                }`}
              >
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center gap-1 font-medium capitalize text-gray-700">
                    {CH_ICON[m.channel]} {m.channel}
                  </span>
                  {inbound && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">Received</span>
                  )}
                  {!inbound && m.status === "failed" && (
                    <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Failed</span>
                  )}
                  {!inbound && m.status === "sent" && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">Sent</span>
                  )}
                  <span className="ml-auto">
                    {new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                  </span>
                </div>
                {m.subject && <p className="mt-1 text-sm font-medium text-gray-900">{m.subject}</p>}
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-gray-700">{m.body}</p>
                {m.error && <p className="mt-1 text-xs text-red-600">{m.error}</p>}
              </div>
            );
          })
        )}
      </div>

      {/* Composer (pinned at bottom) */}
      <div className="shrink-0 space-y-2 border-t border-gray-200 bg-gray-50/60 px-4 py-3">
        <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 text-xs">
          {(["email", "sms", "note"] as Channel[]).map((c) => (
            <button
              key={c}
              onClick={() => setChannel(c)}
              className={`flex items-center gap-1 rounded px-2 py-1 capitalize ${
                channel === c ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
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
