"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";

/** A card whose body is collapsed by default — opened to edit. */
export function CollapsibleCard({
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <h2 className="text-base font-medium text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-400">{subtitle}</p>}
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-gray-500">
          {open ? (
            <>
              Close <ChevronDown className="h-4 w-4" />
            </>
          ) : (
            <>
              <Pencil className="h-3.5 w-3.5" /> Edit <ChevronRight className="h-4 w-4" />
            </>
          )}
        </span>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </section>
  );
}
