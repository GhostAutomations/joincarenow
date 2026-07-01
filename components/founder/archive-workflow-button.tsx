"use client";

import { useState } from "react";
import { Archive } from "lucide-react";
import { archiveStoreWorkflow } from "@/modules/workflows/actions";

/** Founder-only: archive a store workflow into a folder. Asks whether to create
 *  a new folder or add to an existing one. Archived workflows leave the active
 *  list and the company-setup picker (never touches a company's own copy). */
export function ArchiveWorkflowButton({
  workflowId,
  folders,
}: {
  workflowId: string;
  folders: string[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(folders.length ? "existing" : "new");
  const [existing, setExisting] = useState(folders[0] ?? "");
  const [newName, setNewName] = useState("");

  const folder = mode === "new" ? newName.trim() : existing;
  const canSubmit = folder.length > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/70 px-3 py-1.5 text-sm text-gray-700 hover:bg-white"
      >
        <Archive className="h-4 w-4" /> Archive
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl border border-white/50 bg-white/80 p-6 shadow-xl backdrop-blur-md">
            <h3 className="text-base font-semibold text-gray-900">Archive workflow</h3>
            <p className="mt-1 text-sm text-gray-600">
              Move it into a folder to keep your active list tidy. It won&apos;t show when setting up
              a company, and companies already using it are unaffected.
            </p>

            <form action={archiveStoreWorkflow} className="mt-4 space-y-3">
              <input type="hidden" name="workflowId" value={workflowId} />

              {folders.length > 0 && (
                <div className="flex gap-4 text-sm">
                  <label className="inline-flex items-center gap-1.5 text-gray-700">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "existing"}
                      onChange={() => setMode("existing")}
                    />
                    Existing folder
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-gray-700">
                    <input
                      type="radio"
                      name="mode"
                      checked={mode === "new"}
                      onChange={() => setMode("new")}
                    />
                    New folder
                  </label>
                </div>
              )}

              {mode === "existing" && folders.length > 0 ? (
                <select
                  name="folder"
                  value={existing}
                  onChange={(e) => setExisting(e.target.value)}
                  className="block w-full rounded-lg border border-white/40 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  {folders.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              ) : (
                <input
                  name="folder"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Domiciliary, Supported living, Old versions"
                  maxLength={80}
                  autoFocus
                  className="block w-full rounded-lg border border-white/40 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
