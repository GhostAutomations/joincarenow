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
      <div className="flex gap-3">
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
    );
  }

  return (
    <div>
      <div className="mb-3 text-right">
        <button
          type="button"
          onClick={() => setMode(mode === "builder" ? "import" : "builder")}
          className="text-xs text-gray-500 hover:text-brand-700 hover:underline"
        >
          {mode === "builder" ? "Switch to Import from PDF" : "Switch to Form Builder"}
        </button>
      </div>
      {mode === "builder" ? builder : importer}
    </div>
  );
}
