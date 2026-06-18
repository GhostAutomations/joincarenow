"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileText, Plus, Pencil, Trash2 } from "lucide-react";
import { deleteDoc } from "@/modules/contracts/actions";

export type DocItem = { id: string; name: string; body: string; version: number };
type Kind = "contract" | "policy";

export function DocsManager({ kind, items }: { kind: Kind; items: DocItem[] }) {
  const router = useRouter();
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
              <Link
                href={`/settings/documents/${kind}/${d.id}`}
                className="flex items-center gap-2 text-sm font-medium text-gray-900 hover:text-brand-700"
              >
                <FileText className="h-4 w-4 text-gray-400" />
                {d.name}
                <span className="text-xs font-normal text-gray-400">v{d.version}</span>
              </Link>
              <div className="flex items-center gap-1">
                <Link
                  href={`/settings/documents/${kind}/${d.id}`}
                  className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Link>
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

      <Link
        href={`/settings/documents/${kind}/new`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New {noun}
      </Link>
    </div>
  );
}
