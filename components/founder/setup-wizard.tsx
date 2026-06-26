"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle, X, ChevronRight } from "lucide-react";
import { finaliseSetupTask } from "@/modules/setup/actions";

export type WizardTask = {
  key: string;
  label: string;
  description: string;
  /** Add-list sections (branches/roles/workflows) have no single save — they get
   *  a footer "Finalise" button. Single-form sections tick on their own save. */
  isManager: boolean;
  done: boolean;
  content: ReactNode;
};

export function FounderSetupWizard({
  companyId,
  tasks,
}: {
  companyId: string;
  tasks: WizardTask[];
}) {
  const router = useRouter();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const done = tasks.filter((t) => t.done).length;
  const total = tasks.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const active = tasks.find((t) => t.key === openKey) ?? null;

  function closeModal() {
    setOpenKey(null);
    router.refresh(); // pick up any save → progress/ticks update
  }

  async function finaliseManager(key: string) {
    setSaving(true);
    await finaliseSetupTask(companyId, key);
    setSaving(false);
    setOpenKey(null);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Setup progress</h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {done} of {total} done — click a task to complete it.
          </p>
        </div>
        <span className="text-2xl font-semibold text-brand-700">{pct}%</span>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200/70">
        <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mt-4 divide-y divide-gray-200/70">
        {tasks.map((t) => (
          <li key={t.key}>
            <button
              onClick={() => setOpenKey(t.key)}
              className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-white/60"
            >
              {t.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-gray-400" />
              )}
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-medium ${t.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                  {t.label}
                </span>
                <span className="block text-xs text-gray-500">{t.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center">
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-white/60 bg-white/95 p-6 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{active.label}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{active.description}</p>
              </div>
              <button
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4">{active.content}</div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              {active.isManager ? (
                <>
                  <button
                    onClick={closeModal}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    onClick={() => finaliseManager(active.key)}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {saving ? "Finalising…" : "Finalise"}
                  </button>
                </>
              ) : (
                <button
                  onClick={closeModal}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
