"use client";

import { useState } from "react";
import { ChevronDown, Check } from "lucide-react";

/** A compact multi-select dropdown: a button showing a summary that opens a
 *  checkbox popover. Empty selection shows `allLabel`. */
export function MultiSelect({
  options,
  selected,
  onChange,
  allLabel = "All",
  className = "",
}: {
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  allLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const summary =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-white/60 bg-white/70 backdrop-blur-sm px-2 py-1.5 text-left text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      >
        <span className={selected.length ? "text-gray-900" : "text-gray-500"}>{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-white/60 bg-white/90 backdrop-blur-md p-1.5 shadow-lg">
            {options.length === 0 ? (
              <p className="px-2 py-1.5 text-sm text-gray-400">No roles yet.</p>
            ) : (
              options.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-white/70/60"
                  >
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-white/40"}`}>
                      {on && <Check className="h-3 w-3" />}
                    </span>
                    {o.label}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
