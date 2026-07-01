"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { sendProspectMessage, draftInline, type ProspectState } from "@/modules/prospects/actions";

const input = "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type Contact = { id: string; name: string | null; email: string | null; phone: string | null; opted_out: boolean };

export function ProspectComposer({ companyId, contacts }: { companyId: string; contacts: Contact[] }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email");
  const [contactId, setContactId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [draftErr, setDraftErr] = useState<string | null>(null);
  const [drafting, startDraft] = useTransition();
  const [state, action] = useActionState<ProspectState, FormData>(sendProspectMessage, undefined);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setSubject("");
      setBody("");
      router.refresh();
    }
  }, [state, router]);

  const reachable = contacts.filter((c) =>
    !c.opted_out && (channel === "email" ? c.email : channel === "sms" ? c.phone : c.email || c.phone)
  );

  function draft() {
    setDraftErr(null);
    if (!contactId) { setDraftErr("Choose a contact first."); return; }
    startDraft(async () => {
      const r = await draftInline(companyId, contactId, channel === "sms" ? "sms" : "email");
      if (r.error) setDraftErr(r.error);
      else { setSubject(r.subject ?? ""); setBody(r.body ?? ""); }
    });
  }

  return (
    <form ref={ref} action={action} className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <input type="hidden" name="id" value={companyId} />
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-white/40 bg-white p-0.5 text-sm">
          {(["email", "sms", "both"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={`rounded-md px-3 py-1 capitalize ${channel === c ? "bg-brand-600 text-white" : "text-gray-600"}`}
            >
              {c === "both" ? "Both" : c}
            </button>
          ))}
        </div>
        <input type="hidden" name="channel" value={channel} />
        <select
          name="contactId"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="flex-1 rounded-lg border border-white/40 px-2.5 py-1.5 text-sm"
        >
          <option value="" disabled>Choose contact…</option>
          {reachable.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name || (channel === "email" ? c.email : c.phone)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={draft}
          disabled={drafting}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" /> {drafting ? "Drafting…" : "Draft with AI"}
        </button>
      </div>

      {reachable.length === 0 && (
        <p className="mt-2 text-xs text-amber-700">No reachable {channel} contacts (missing {channel} or opted out).</p>
      )}
      {draftErr && <p className="mt-2 text-xs text-red-600">{draftErr}</p>}

      {channel === "email" && (
        <input name="subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className={input} />
      )}
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder={`Message… (use {{first_name}}, {{company_name}})`}
        className={`${input} font-mono text-xs`}
      />

      <div className="mt-2 flex items-center gap-3">
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Send className="h-4 w-4" /> Send {channel}
        </button>
        {state?.ok && <span className="text-sm text-green-700">Sent.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
      <p className="mt-2 text-xs text-gray-400">AI drafts appear here for you to edit and send — nothing sends until you click Send.</p>
    </form>
  );
}
