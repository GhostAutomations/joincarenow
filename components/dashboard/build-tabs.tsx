"use client";

import { useState, type ReactNode } from "react";

/** Opens showing only two buttons (Form Builder | Import from PDF). Once one is
 *  chosen, the buttons are replaced by that panel, with a small link to switch. */
export function BuildTabs({
  builder,
  importer,
  initialMode = null,
}: {
  builder: ReactNode;
  importer: ReactNode;
  initialMode?: "builder" | "import" | null;
}) {
  const [mode, setMode] = useState<"builder" | "import" | null>(initialMode);

  if (!mode) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">How do you want to build this form?</h2>
        <p className="mt-1 text-sm text-gray-500">
          Build it by hand with the drag-and-drop builder, generate the questions
          with AI, or import them from an existing PDF.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setMode("builder")}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Build by hand
          </button>
          <button
            type="button"
            onClick={() => setMode("import")}
            className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Generate with AI / import
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Switch only shown on the Import view (so you can get back); the
          Builder view keeps its top-right clean for the Preview button. */}
      {mode === "import" && (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={() => setMode("builder")}
            className="rounded-lg border border-white/40 bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm hover:bg-white/25"
          >
            Switch to Form Builder
          </button>
        </div>
      )}
      {mode === "builder" ? builder : importer}
    </div>
  );
}
