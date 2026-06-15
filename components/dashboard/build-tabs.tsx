"use client";

import { useState, type ReactNode } from "react";

/** Two buttons at the top of the builder screen: Form Builder | Import from PDF.
 *  Shows the matching panel below. */
export function BuildTabs({
  builder,
  importer,
}: {
  builder: ReactNode;
  importer: ReactNode;
}) {
  const [mode, setMode] = useState<"builder" | "import" | null>(null);

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("builder")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "builder"
              ? "bg-brand-600 text-white"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Form Builder
        </button>
        <button
          type="button"
          onClick={() => setMode("import")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${
            mode === "import"
              ? "bg-brand-600 text-white"
              : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          Import from PDF
        </button>
      </div>

      {mode && <div className="mt-6">{mode === "builder" ? builder : importer}</div>}
    </div>
  );
}
