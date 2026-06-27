"use client";

import { useState } from "react";
import { ChevronDown, Trash2 } from "lucide-react";

export type WorkflowItem = { id: string; title: string; meta: string };

/** Collapsible workflow card on the Workflow board. Collapsed by default. */
export function WorkflowCard({
  name,
  subtitle,
  items,
  workflowId,
  deleteWorkflow,
  deleteTask,
}: {
  name: string;
  subtitle: string;
  items: WorkflowItem[];
  workflowId: string | null;
  deleteWorkflow: (formData: FormData) => void | Promise<void>;
  deleteTask: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-white/50 bg-white/70 backdrop-blur-sm shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          <span className="truncate text-sm font-semibold text-gray-900">{name}</span>
          <span className="shrink-0 text-xs text-gray-400">{subtitle}</span>
        </button>
        {workflowId && (
          <form action={deleteWorkflow}>
            <input type="hidden" name="workflowId" value={workflowId} />
            <button
              className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600"
              aria-label="Delete workflow"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </form>
        )}
      </div>

      {open && (
        <ul className="divide-y divide-white/50 border-t border-white/50 px-3">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between py-2">
              <div className="min-w-0">
                <span className="text-sm text-gray-800">{t.title}</span>
                <span className="ml-2 text-xs text-gray-400">{t.meta}</span>
              </div>
              <form action={deleteTask}>
                <input type="hidden" name="id" value={t.id} />
                <button
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
