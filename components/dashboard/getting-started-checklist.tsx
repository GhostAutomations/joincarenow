import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

export type ChecklistItem = {
  label: string;
  hint: string;
  href: string;
  done: boolean;
};

/** Admin-only "getting started" card shown on the dashboard until every setup
 *  step is complete. Glassy card over the gradient, consistent with the home
 *  stat cards. Renders nothing when fully set up. */
export function GettingStartedChecklist({ items }: { items: ChecklistItem[] }) {
  const done = items.filter((i) => i.done).length;
  const total = items.length;
  if (done >= total) return null;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="mt-6 rounded-2xl border border-white/25 bg-white/15 p-5 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Finish setting up your account</p>
          <p className="text-xs text-white/70">
            {done} of {total} done · your account came pre-loaded — just review and make it yours.
          </p>
        </div>
        <span className="text-2xl font-semibold text-white">{pct}%</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div className="h-full rounded-full bg-white/80 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 space-y-1.5">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="group flex items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-white/15"
            >
              {item.done ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-white/50 group-hover:text-white/80" />
              )}
              <span className="min-w-0">
                <span
                  className={`block text-sm font-medium ${item.done ? "text-white/60 line-through" : "text-white"}`}
                >
                  {item.label}
                </span>
                {!item.done && <span className="block text-xs text-white/60">{item.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
