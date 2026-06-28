"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { DocEditorForm } from "@/components/dashboard/doc-editor-form";
import { saveFounderDoc, deleteFounderDoc } from "@/modules/contracts/actions";

type Kind = "contract" | "policy" | "job_description";
export type FounderDoc = { id: string; name: string; body: string };

/** Inline (in the founder setup wizard) document manager for a company:
 *  list + add/edit/delete with the full paste / upload / AI / merge editor. */
export function FounderDocsManager({
  companyId,
  kind,
  items,
  noun,
}: {
  companyId: string;
  kind: Kind;
  items: FounderDoc[];
  noun: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FounderDoc | "new" | null>(null);

  async function onDelete(id: string) {
    if (!confirm(`Delete this ${noun}?`)) return;
    const r = await deleteFounderDoc(kind, companyId, id);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  if (editing) {
    const doc = editing === "new" ? null : { id: editing.id, name: editing.name, body: editing.body };
    return (
      <DocEditorForm
        key={editing === "new" ? "new" : editing.id}
        kind={kind}
        doc={doc}
        embedded
        companyId={companyId}
        saveAction={saveFounderDoc}
        onSaved={() => { setEditing(null); router.refresh(); }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 divide-y divide-white/40">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2">
              <button
                type="button"
                onClick={() => setEditing(d)}
                className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-brand-700"
              >
                <FileText className="h-4 w-4 text-gray-400" /> {d.name}
              </button>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setEditing(d)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Edit">
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => onDelete(d.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => setEditing("new")}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New {noun}
      </button>
    </div>
  );
}
