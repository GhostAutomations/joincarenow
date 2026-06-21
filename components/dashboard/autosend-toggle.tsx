"use client";

import { useRef } from "react";
import { Sparkles } from "lucide-react";
import { setAutoSendMode } from "@/modules/prospects/actions";

export function AutoSendToggle({ mode }: { mode: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={setAutoSendMode} className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/15 px-2.5 py-1 text-white backdrop-blur">
      <Sparkles className="h-3.5 w-3.5" />
      <span className="text-xs">AI auto-send</span>
      <select
        name="mode"
        defaultValue={mode}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-md border border-white/30 bg-white/90 px-2 py-0.5 text-xs text-gray-900"
      >
        <option value="off">Off (approve all)</option>
        <option value="low_risk">Low-risk only</option>
        <option value="all">All</option>
      </select>
    </form>
  );
}
