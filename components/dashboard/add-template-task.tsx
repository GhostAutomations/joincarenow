"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, CheckCircle2 } from "lucide-react";
import { addTemplateTasks, type TaskDraft } from "@/modules/onboarding/actions";
import { MultiSelect } from "@/components/dashboard/multi-select";

const cls =
  "mt-1 block w-full rounded-md border border-white/60 bg-white/70 backdrop-blur-sm shadow-sm px-2 py-1.5 text-sm text-gray-900 placeholder:text-gray-500 focus:border-brand-500 focus:bg-white/90 focus:outline-none focus:ring-1 focus:ring-brand-500";

type Box = {
  taskType: string;
  formIds: string[];
  dueDays: string;
  required: boolean;
  triggerStage: string;
  poppyEngage: string;
  poppyFormIds: string[];
  poppyIncludeCv: boolean;
};

const blankBox = (): Box => ({
  taskType: "document",
  formIds: [],
  dueDays: "",
  required: true,
  triggerStage: "",
  poppyEngage: "",
  poppyFormIds: [],
  poppyIncludeCv: false,
});

export function AddTemplateTask({
  forms,
  roleOptions = [],
  saveAction = addTemplateTasks,
  showRole = true,
  roleLabel = "Applies to roles",
  poppyEnabled = false,
}: {
  forms: { id: string; name: string }[];
  /** Company: value = role UUID. Founder store: value = standard role name. */
  roleOptions?: { value: string; label: string }[];
  /** Server action that saves the drafts. Defaults to the company workflow
   *  builder; the Founder workflow store passes its own store-saving action. */
  saveAction?: (drafts: TaskDraft[]) => Promise<{ ok?: boolean; error?: string }>;
  showRole?: boolean;
  roleLabel?: string;
  /** Show the Poppy AI screening step type (company has Poppy). */
  poppyEnabled?: boolean;
}) {
  const router = useRouter();
  // Workflow-level (shared across all tasks in this workflow).
  const [title, setTitle] = useState("");
  const [roleValues, setRoleValues] = useState<string[]>([]);
  const [body, setBody] = useState("");
  // The repeatable task boxes.
  const [boxes, setBoxes] = useState<Box[]>([blankBox()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);

  function reset() {
    setTitle("");
    setRoleValues([]);
    setBody("");
    setBoxes([blankBox()]);
    setCreated(false);
    setError(null);
  }

  function updateBox(i: number, patch: Partial<Box>) {
    setBoxes((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }
  function toggleForm(i: number, id: string) {
    setBoxes((bs) =>
      bs.map((b, idx) =>
        idx === i
          ? {
              ...b,
              formIds: b.formIds.includes(id)
                ? b.formIds.filter((x) => x !== id)
                : [...b.formIds, id],
            }
          : b
      )
    );
  }
  function togglePoppyForm(i: number, id: string) {
    setBoxes((bs) =>
      bs.map((b, idx) =>
        idx === i
          ? {
              ...b,
              poppyFormIds: b.poppyFormIds.includes(id)
                ? b.poppyFormIds.filter((x) => x !== id)
                : [...b.poppyFormIds, id],
            }
          : b
      )
    );
  }

  async function submit() {
    setError(null);
    const drafts: TaskDraft[] = boxes.map((b) => ({
      title,
      taskType: b.taskType,
      formIds: b.formIds,
      dueDays: b.dueDays,
      required: b.required,
      body,
      triggerStage: b.triggerStage,
      roleValues,
      poppyEngage: b.poppyEngage,
      poppyFormIds: b.poppyFormIds,
      poppyIncludeCv: b.poppyIncludeCv,
    }));
    setSaving(true);
    const res = await saveAction(drafts);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setCreated(true);
    router.refresh();
  }

  if (created) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-green-800">
          <CheckCircle2 className="h-5 w-5" /> Workflow created
        </span>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white/80 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          <Plus className="h-4 w-4" /> Create another workflow
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">{error}</p>
      )}

      {/* Workflow-level: title + role (once for the whole workflow). */}
      <div className={`grid grid-cols-1 gap-3 ${showRole ? "sm:grid-cols-2" : ""}`}>
        <label className="text-xs font-medium text-gray-600">
          Workflow title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. New starter onboarding"
            className={cls}
          />
        </label>
        {showRole && (
          <div className="text-xs font-medium text-gray-600">
            {roleLabel}
            <MultiSelect
              options={roleOptions}
              selected={roleValues}
              onChange={setRoleValues}
              allLabel="All roles"
              className="mt-1"
            />
            <span className="mt-1 block text-[11px] font-normal text-gray-400">None selected = all roles.</span>
          </div>
        )}
      </div>

      {/* One box per task. */}
      {boxes.map((b, i) => (
        <div key={i} className="relative space-y-3 rounded-lg border border-white/50 bg-white/50 backdrop-blur-sm p-3">
          {boxes.length > 1 && (
            <button
              type="button"
              onClick={() => setBoxes((bs) => bs.filter((_, idx) => idx !== i))}
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
                value={b.taskType}
                onChange={(e) => updateBox(i, { taskType: e.target.value })}
                className={cls}
              >
                <option value="document">Upload a document</option>
                <option value="form">Fill in a form</option>
                <option value="acknowledge">Read &amp; confirm</option>
                {poppyEnabled && <option value="poppy">Poppy AI screening</option>}
              </select>
            </label>
            {b.taskType === "poppy" ? (
              <label className="text-xs font-medium text-gray-600">
                When should Poppy engage?
                <select
                  value={b.poppyEngage}
                  onChange={(e) => updateBox(i, { poppyEngage: e.target.value })}
                  className={cls}
                >
                  <option value="" disabled>Select one…</option>
                  <option value="all_forms">When the selected forms are complete</option>
                  <option value="as_forms">As the selected forms come in</option>
                  <option value="stage">When they reach a pipeline stage</option>
                </select>
              </label>
            ) : (
              <label className="text-xs font-medium text-gray-600">
                Send this to the applicant when…
                <select
                  value={b.triggerStage}
                  onChange={(e) => updateBox(i, { triggerStage: e.target.value })}
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
            )}
          </div>

          {/* Poppy: pick the stage (when engage = stage) + the forms it reviews. */}
          {b.taskType === "poppy" && (
            <>
              {b.poppyEngage === "stage" && (
                <label className="text-xs font-medium text-gray-600">
                  Which stage?
                  <select
                    value={b.triggerStage}
                    onChange={(e) => updateBox(i, { triggerStage: e.target.value })}
                    className={cls}
                  >
                    <option value="" disabled>Select one…</option>
                    <option value="on_application">Application submitted</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="interview">Interview</option>
                    <option value="right_to_work">Right to work</option>
                    <option value="offer">Offer</option>
                    <option value="hired">Hired</option>
                  </select>
                </label>
              )}
              <div className="text-xs font-medium text-gray-600">
                Forms Poppy reviews
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 backdrop-blur-sm p-2">
                  {/* CV is reviewable like a form (counts toward 'complete' once uploaded). */}
                  <label className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                    <input
                      type="checkbox"
                      checked={b.poppyIncludeCv}
                      onChange={() => updateBox(i, { poppyIncludeCv: !b.poppyIncludeCv })}
                      className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                    />
                    CV (uploaded)
                  </label>
                  {forms.length === 0 ? (
                    <p className="px-1 font-normal text-gray-400">No forms yet — create one in Forms first.</p>
                  ) : (
                    forms.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                        <input
                          type="checkbox"
                          checked={b.poppyFormIds.includes(f.id)}
                          onChange={() => togglePoppyForm(i, f.id)}
                          className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                        />
                        {f.name}
                      </label>
                    ))
                  )}
                </div>
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  Poppy compares these against the job description to build screening questions.
                </span>
              </div>
            </>
          )}

          {b.taskType === "form" && (
            <div className="text-xs font-medium text-gray-600">
              Form(s) to complete
              {forms.length === 0 ? (
                <p className="mt-1 font-normal text-gray-400">
                  No forms yet — create one in Forms first.
                </p>
              ) : (
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 backdrop-blur-sm p-2">
                  {forms.map((f) => (
                    <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                      <input
                        type="checkbox"
                        checked={b.formIds.includes(f.id)}
                        onChange={() => toggleForm(i, f.id)}
                        className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
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

          {/* Due / required don't apply to the Poppy step. */}
          {b.taskType !== "poppy" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-gray-600">
                Due within (days)
                <input
                  value={b.dueDays}
                  onChange={(e) => updateBox(i, { dueDays: e.target.value })}
                  type="number"
                  min="0"
                  placeholder="e.g. 7"
                  className={cls}
                />
              </label>
              <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={b.required}
                  onChange={(e) => updateBox(i, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-white/40 text-brand-600"
                />
                Required
              </label>
            </div>
          )}
        </div>
      ))}

      {/* Add another task box (above the shared Instructions). */}
      <div className="flex justify-center py-1">
        <button
          type="button"
          onClick={() => setBoxes((bs) => [...bs, blankBox()])}
          aria-label="Add another task"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/60 bg-white/70 backdrop-blur-sm text-gray-600 hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <label className="block text-xs font-medium text-gray-600">
        Instructions (optional)
        <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} className={cls} />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={saving}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "Creating…" : "Create Workflow"}
      </button>
    </div>
  );
}
