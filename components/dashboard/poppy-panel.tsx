"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { PoppySettingsForm } from "@/components/dashboard/poppy-settings-form";
import { PoppyAttributesForm } from "@/components/dashboard/poppy-attributes-form";
import type { PoppyConfig } from "@/lib/poppy/config";

/** The Poppy settings section. Shows Poppy's tuning, with Attributes as its own
 *  sub-screen (opened from here, not expanded inline). */
export function PoppyPanel({
  config,
  usage,
}: {
  config: PoppyConfig;
  usage?: { used: number; included: number } | null;
}) {
  const [view, setView] = useState<"main" | "attributes">("main");

  if (view === "attributes") {
    return (
      <div>
        <button
          onClick={() => setView("main")}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
        >
          <ChevronLeft className="h-4 w-4" /> Poppy settings
        </button>
        <h3 className="mt-3 text-base font-semibold text-gray-900">Attributes</h3>
        <p className="mt-0.5 text-sm text-gray-500">
          The professional and personal attributes Poppy assesses every candidate against — split into
          required and desirable.
        </p>
        <PoppyAttributesForm config={config} />
      </div>
    );
  }

  return (
    <div>
      {/* Attributes sub-screen entry */}
      <button
        onClick={() => setView("attributes")}
        className="flex w-full items-center gap-3 rounded-xl border border-white/50 bg-white/60 px-4 py-3 text-left backdrop-blur-sm transition hover:bg-white/80"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white shadow-sm">
          <ListChecks className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900">Attributes</span>
          <span className="block text-xs text-gray-500">
            The professional &amp; personal attributes Poppy screens candidates against.
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
      </button>

      <PoppySettingsForm config={config} usage={usage} />
    </div>
  );
}
