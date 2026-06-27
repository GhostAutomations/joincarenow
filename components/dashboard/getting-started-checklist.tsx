"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Circle } from "lucide-react";
import { dismissOnboardingChecklist } from "@/modules/companies/actions";

export type ChecklistItem = {
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

/** Admin-only "getting started" card. Shows ONLY the outstanding tasks; once
 *  they're all done it dismisses itself permanently (a flag on the company) so
 *  it never shows again, even if data later changes. */
export function GettingStartedChecklist({
  items,
  dismissed = false,
}: {
  items: ChecklistItem[];
  dismissed?: boolean;
}) {
  const total = items.length;
  const done = items.filter((i) => i.done).length;
  const remaining = items.filter((i) => !i.done);
  const allDone = remaining.length === 0;

  // Persist the dismissal once everything's complete (fire once).
  const dismissedRef = useRef(false);
  useEffect(() => {
    if (allDone && !dismissed && !dismissedRef.current) {
      dismissedRef.current = true;
      void dismissOnboardingChecklist();
    }
  }, [allDone, dismissed]);

  if (dismissed || allDone) return null;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mt-6 rounded-2xl border border-white/25 bg-white/15 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Finish setting up your account</p>
          <p className="text-xs text-white/70">
            {remaining.length} {remaining.length === 1 ? "task" : "tasks"} to go · your account came
            pre-loaded — just make it yours.
          </p>
        </div>
        <span className="text-2xl font-semibold text-white">{pct}%</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {remaining.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/15"
            >
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/50 group-hover:text-white/80" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{item.label}</span>
                <span className="block text-xs text-white/60">{item.hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
