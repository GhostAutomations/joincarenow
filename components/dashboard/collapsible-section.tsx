"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

/** A titled, collapsible section. Children are passed in (can be server-rendered).
 *  Used to group forms by category on the Forms and File Store screens. */
export function CollapsibleSection({
  title,
  subtitle,
  badge,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-gray-900">{title}</span>
            {subtitle && <span className="block truncate text-xs text-gray-500">{subtitle}</span>}
          </span>
          {typeof count === "number" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {count}
            </span>
          )}
          {badge && (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open && <div className="border-t border-slate-100 p-3">{children}</div>}
    </section>
  );
}
