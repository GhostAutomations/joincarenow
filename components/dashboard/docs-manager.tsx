"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Pencil, Trash2, X } from "lucide-react";
import { saveDoc, deleteDoc } from "@/modules/contracts/actions";

export type DocItem = { id: string; name: string; body: string; version: number };
type Kind = "contract" | "policy";

const MERGE_FIELDS = [
  "first_name",
  "last_name",
  "job_title",
  "role",
  "pay",
  "hours",
  "start_date",
  "company_name",
  "conditions",
];

export function DocsManager({ kind, items }: { kind: Kind; items: DocItem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<DocItem | "new" | null>(null);

  const noun = kind === "contract" ? "contract template" : "policy";

  async function onDelete(id: string) {
    if (!confirm(`Delete this ${noun}? This won't affect copies already signed.`)) return;
    const r = await deleteDoc(kind, id);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-100">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <FileText className="h-4 w-4 text-gray-400" />
                {d.name}
                <span className="text-xs font-normal text-gray-400">v{d.version}</span>
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setEditing(d)}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(d.id)}
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={() => setEditing("new")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New {noun}
      </button>

      {editing && (
        <DocEditor
          kind={kind}
          doc={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function DocEditor({
  kind,
  doc,
  onClose,
  onSaved,
}: {
  kind: Kind;
  doc: DocItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = kind === "contract" ? "contract template" : "policy";

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    if (doc) fd.set("id", doc.id);
    const r = await saveDoc(kind, fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">
            {doc ? `Edit ${noun}` : `New ${noun}`}
          </h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={action} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Name</span>
            <input
              name="name"
              defaultValue={doc?.name ?? ""}
              placeholder={kind === "contract" ? "e.g. Care Assistant — Permanent Contract" : "e.g. Data Protection (GDPR) Policy"}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>

          <p className="text-xs text-gray-500">
            Editing creates a new version — copies already signed are never changed.
          </p>

          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Merge fields (filled in automatically when sent):{" "}
            {MERGE_FIELDS.map((f) => (
              <code key={f} className="mr-1 rounded bg-white px-1 py-0.5 text-[11px] text-brand-700 ring-1 ring-gray-200">
                {`{{${f}}}`}
              </code>
            ))}
          </div>

          <label className="flex min-h-0 flex-1 flex-col">
            <span className="text-xs font-medium text-gray-600">
              {kind === "contract" ? "Contract text" : "Policy text"}
            </span>
            <textarea
              name="body"
              defaultValue={doc?.body ?? ""}
              placeholder={`Write the ${noun} here. Use the merge fields above where you want details filled in, e.g. "This contract is between {{company_name}} and {{first_name}} {{last_name}} for the role of {{role}}, starting {{start_date}}."`}
              className="mt-1 min-h-[240px] flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              disabled={busy}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy ? "Saving…" : doc ? "Save changes" : `Create ${noun}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
