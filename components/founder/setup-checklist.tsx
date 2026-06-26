import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

export type SetupTask = {
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

/** Founder-facing setup progress for a company. Glassy card with a progress bar
 *  and a clickable to-do list — each item jumps to that setup section. */
export function FounderSetupChecklist({ tasks }: { tasks: SetupTask[] }) {
  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Setup progress</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {done} of {total} done — click a task to jump straight to it.
          </p>
        </div>
        <span className="text-2xl font-semibold text-brand-700">{pct}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200/70">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-1 sm:grid-cols-2">
        {tasks.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/60">
              {t.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-gray-400 group-hover:text-brand-600" />
              )}
              <span className="min-w-0">
                <span className={`block text-sm font-medium ${t.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  {t.label}
                </span>
                {!t.done && <span className="block text-xs text-gray-500">{t.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
