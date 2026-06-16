"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2, Mail, MessageSquare, Pencil } from "lucide-react";
import { saveTemplate, deleteTemplate, type TemplateState } from "@/modules/comms/templates-actions";

export type Template = {
  id: string;
  channel: "email" | "sms";
  name: string;
  subject: string | null;
  body: string;
  category: string | null;
};

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const MERGE_FIELDS = [
  "first_name", "last_name", "job_title", "company_name", "recruiter_name", "portal_link",
];

export function TemplatesManager({ templates }: { templates: Template[] }) {
  const [state, action] = useActionState<TemplateState, FormData>(saveTemplate, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState<Template | null>(null);
  const [channel, setChannel] = useState<"email" | "sms">("email");

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setEditing(null);
      setChannel("email");
    }
  }, [state]);

  function edit(t: Template) {
    setEditing(t);
    setChannel(t.channel);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const email = templates.filter((t) => t.channel === "email");
  const sms = templates.filter((t) => t.channel === "sms");

  return (
    <div className="space-y-8">
      {/* Editor */}
      <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-6">
        <h2 className="text-base font-medium text-gray-900">
          {editing ? "Edit template" : "New template"}
        </h2>
        <form ref={formRef} action={action} className="mt-4 space-y-3" key={editing?.id ?? "new"}>
          {state?.error && (
            <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{state.error}</p>
          )}
          {editing && <input type="hidden" name="id" value={editing.id} />}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="text-xs font-medium text-gray-600">
              Channel
              <select
                name="channel"
                value={channel}
                onChange={(e) => setChannel(e.target.value as "email" | "sms")}
                className={cls}
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600 sm:col-span-2">
              Template name
              <input name="name" defaultValue={editing?.name ?? ""} placeholder="e.g. Interview invite" className={cls} />
            </label>
          </div>

          {channel === "email" && (
            <label className="block text-xs font-medium text-gray-600">
              Subject
              <input name="subject" defaultValue={editing?.subject ?? ""} placeholder="e.g. Your interview with {{company_name}}" className={cls} />
            </label>
          )}

          <label className="block text-xs font-medium text-gray-600">
            Message
            <textarea name="body" rows={channel === "sms" ? 3 : 6} defaultValue={editing?.body ?? ""} className={cls} />
          </label>

          <label className="block text-xs font-medium text-gray-600">
            Category (optional)
            <input name="category" defaultValue={editing?.category ?? ""} placeholder="e.g. Interview, Offer, Rejection" className={cls} />
          </label>

          <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
            Merge fields you can use:{" "}
            {MERGE_FIELDS.map((f) => (
              <code key={f} className="mr-1 rounded bg-white px-1 py-0.5 text-gray-700">{`{{${f}}}`}</code>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              {editing ? "Save changes" : "Add template"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(null); setChannel("email"); formRef.current?.reset(); }}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <TemplateList title="Email templates" icon={<Mail className="h-4 w-4 text-gray-400" />} items={email} onEdit={edit} />
      <TemplateList title="SMS templates" icon={<MessageSquare className="h-4 w-4 text-gray-400" />} items={sms} onEdit={edit} />
    </div>
  );
}

function TemplateList({
  title, icon, items, onEdit,
}: {
  title: string;
  icon: React.ReactNode;
  items: Template[];
  onEdit: (t: Template) => void;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 text-sm font-medium text-gray-700">{icon}{title}</h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">No templates yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
          {items.map((t) => (
            <li key={t.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {t.name}
                  {t.category && <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">{t.category}</span>}
                </p>
                {t.subject && <p className="mt-0.5 text-xs text-gray-500">Subject: {t.subject}</p>}
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">{t.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={() => onEdit(t)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <form action={deleteTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
