"use client";

import { useState, type ReactNode } from "react";

/** Opens showing only two buttons (Form Builder | Import from PDF). Once one is
 *  chosen, the buttons are replaced by that panel, with a small link to switch. */
export function BuildTabs({
  builder,
  importer,
}: {
  builder: ReactNode;
  importer: ReactNode;
}) {
  const [mode, setMode] = useState<"builder" | "import" | null>(null);

  if (!mode) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">How do you want to build this form?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Start from scratch with the drag-and-drop builder, or import questions
          from an existing PDF form.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode("builder")}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Form Builder
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Import from PDF
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => setMode(mode === "builder" ? "import" : "builder")}
          className="rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25"
        >
          {mode === "builder" ? "Switch to Import from PDF" : "Switch to Form Builder"}
        </button>
      </div>
      {mode === "builder" ? builder : importer}
    </div>
  );
}
