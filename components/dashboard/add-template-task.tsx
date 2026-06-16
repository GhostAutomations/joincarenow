"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { addTemplateTasks, type TaskDraft } from "@/modules/onboarding/actions";

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const blank = (): TaskDraft => ({
  title: "",
  taskType: "document",
  formIds: [],
  dueDays: "",
  required: true,
  body: "",
  triggerStage: "",
  roleId: "",
});

export function AddTemplateTask({
  forms,
  roles,
}: {
  forms: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskDraft[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(i: number, patch: Partial<TaskDraft>) {
    setTasks((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function toggleForm(i: number, id: string) {
    setTasks((ts) =>
      ts.map((t, idx) =>
        idx === i
          ? {
              ...t,
              formIds: t.formIds.includes(id)
                ? t.formIds.filter((x) => x !== id)
                : [...t.formIds, id],
            }
          : t
      )
    );
  }

  async function submit() {
    setError(null);
    setSaving(true);
    const res = await addTemplateTasks(tasks);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setTasks([blank()]);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}

      {tasks.map((t, i) => (
        <div key={i} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-gray-600">
              Workflow title
              <input
                value={t.title}
                onChange={(e) => update(i, { title: e.target.value })}
                placeholder="e.g. Right to Work check"
                className={cls}
              />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Role association
              <select
                value={t.roleId}
                onChange={(e) => update(i, { roleId: e.target.value })}
                className={cls}
              >
                <option value="">All roles</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="relative space-y-3 rounded-lg border border-gray-200 bg-white p-3">
            {tasks.length > 1 && (
              <button
                type="button"
                onClick={() => setTasks((ts) => ts.filter((_, idx) => idx !== i))}
                aria-label="Remove this task"
                className="absolute right-2 top-2 rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Type
                <select
                  value={t.taskType}
                  onChange={(e) => update(i, { taskType: e.target.value })}
                  className={cls}
                >
                  <option value="document">Upload a document</option>
                  <option value="form">Fill in a form</option>
                  <option value="acknowledge">Read &amp; confirm</option>
                </select>
              </label>
              <label className="text-xs font-medium text-gray-600">
                Send this to the applicant when…
                <select
                  value={t.triggerStage}
                  onChange={(e) => update(i, { triggerStage: e.target.value })}
                  className={cls}
                >
                  <option value="" disabled>Select one…</option>
                  <option value="on_application">They submit their application</option>
                  <option value="reviewing">They reach Reviewing</option>
                  <option value="interview">They reach Interview</option>
                  <option value="offer">They reach Offer</option>
                  <option value="hired">They are Hired</option>
                </select>
              </label>
            </div>

            {t.taskType === "form" && (
              <div className="text-xs font-medium text-gray-600">
                Form(s) to complete
                {forms.length === 0 ? (
                  <p className="mt-1 font-normal text-gray-400">
                    No forms yet — create one in Forms first.
                  </p>
                ) : (
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-gray-300 bg-white p-2">
                    {forms.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={t.formIds.includes(f.id)}
                          onChange={() => toggleForm(i, f.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                        {f.name}
                      </label>
                    ))}
                  </div>
                )}
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  Tick one or more. Each becomes its own task.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Due within (days)
                <input
                  value={t.dueDays}
                  onChange={(e) => update(i, { dueDays: e.target.value })}
                  type="number"
                  min="0"
                  placeholder="e.g. 7"
                  className={cls}
                />
              </label>
              <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={t.required}
                  onChange={(e) => update(i, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                Required
              </label>
            </div>
          </div>

          {/* Add another task box (inserts right after this one). */}
          <div className="flex justify-center py-1">
            <button
              type="button"
              onClick={() =>
                setTasks((ts) => {
                  const next = [...ts];
                  next.splice(i + 1, 0, blank());
                  return next;
                })
              }
              aria-label="Add another task"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-500 hover:border-brand-400 hover:text-brand-600"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <label className="block text-xs font-medium text-gray-600">
            {t.taskType === "acknowledge" ? "Text to read & confirm" : "Instructions (optional)"}
            <textarea
              value={t.body}
              onChange={(e) => update(i, { body: e.target.value })}
              rows={2}
              className={cls}
            />
          </label>
        </div>
      ))}

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Adding…" : tasks.length > 1 ? `Add ${tasks.length} tasks to checklist` : "Add to checklist"}
      </button>
    </div>
  );
}
