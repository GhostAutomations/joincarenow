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
  rubyEngage: string;
  rubyFormIds: string[];
  rubyIncludeCv: boolean;
  rubyDocumentIds: string[];
};

const blankBox = (): Box => ({
  taskType: "document",
  formIds: [],
  dueDays: "",
  required: true,
  triggerStage: "",
  rubyEngage: "",
  rubyFormIds: [],
  rubyIncludeCv: false,
  rubyDocumentIds: [],
});

export function AddTemplateTask({
  forms,
  rubyDocs = [],
  roleOptions = [],
  saveAction = addTemplateTasks,
  showRole = true,
  roleLabel = "Applies to roles",
  rubyEnabled = false,
  appendMode = false,
}: {
  forms: { id: string; name: string }[];
  /** Company documents (policies + contracts) Ruby can compare against. */
  rubyDocs?: { id: string; name: string }[];
  /** Company: value = role UUID. Founder store: value = standard role name. */
  roleOptions?: { value: string; label: string }[];
  /** Server action that saves the drafts. Defaults to the company workflow
   *  builder; the Founder workflow store passes its own store-saving action. */
  saveAction?: (drafts: TaskDraft[]) => Promise<{ ok?: boolean; error?: string }>;
  showRole?: boolean;
  roleLabel?: string;
  /** Show the Ruby AI screening step type (company has Ruby). */
  rubyEnabled?: boolean;
  /** Appending to an existing workflow — hide the workflow-level role field and
   *  relabel the title/CTA (name + roles come from the existing workflow). */
  appendMode?: boolean;
}) {
  const roleVisible = showRole && !appendMode;
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
  function toggleRubyDoc(i: number, id: string) {
    setBoxes((bs) =>
      bs.map((b, idx) =>
        idx === i
          ? {
              ...b,
              rubyDocumentIds: b.rubyDocumentIds.includes(id)
                ? b.rubyDocumentIds.filter((x) => x !== id)
                : [...b.rubyDocumentIds, id],
            }
          : b
      )
    );
  }
  function toggleRubyForm(i: number, id: string) {
    setBoxes((bs) =>
      bs.map((b, idx) =>
        idx === i
          ? {
              ...b,
              rubyFormIds: b.rubyFormIds.includes(id)
                ? b.rubyFormIds.filter((x) => x !== id)
                : [...b.rubyFormIds, id],
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
      rubyEngage: b.rubyEngage,
      rubyFormIds: b.rubyFormIds,
      rubyIncludeCv: b.rubyIncludeCv,
      rubyDocumentIds: b.rubyDocumentIds,
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
          <CheckCircle2 className="h-5 w-5" /> {appendMode ? "Added to workflow" : "Workflow created"}
        </span>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-green-300 bg-white/80 backdrop-blur-sm px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          <Plus className="h-4 w-4" /> {appendMode ? "Add another task" : "Create another workflow"}
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
      <div className={`grid grid-cols-1 gap-3 ${roleVisible ? "sm:grid-cols-2" : ""}`}>
        <label className="text-xs font-medium text-gray-600">
          {appendMode ? "Task title" : "Workflow title"}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={appendMode ? "e.g. Upload passport" : "e.g. New starter onboarding"}
            className={cls}
          />
        </label>
        {roleVisible && (
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
                {rubyEnabled && <option value="ruby">Ruby AI screening</option>}
              </select>
            </label>
            {b.taskType === "ruby" ? (
              <label className="text-xs font-medium text-gray-600">
                When should Ruby engage?
                <select
                  value={b.rubyEngage}
                  onChange={(e) => updateBox(i, { rubyEngage: e.target.value })}
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

          {/* Ruby: pick the stage (when engage = stage) + the forms it reviews. */}
          {b.taskType === "ruby" && (
            <>
              {b.rubyEngage === "stage" && (
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
                    <option value="right_to_work">RTW & Referencing</option>
                    <option value="offer">Offer</option>
                    <option value="hired">Hired</option>
                  </select>
                </label>
              )}
              <div className="text-xs font-medium text-gray-600">
                Forms Ruby reviews
                <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 backdrop-blur-sm p-2">
                  {/* CV is reviewable like a form (counts toward 'complete' once uploaded). */}
                  <label className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                    <input
                      type="checkbox"
                      checked={b.rubyIncludeCv}
                      onChange={() => updateBox(i, { rubyIncludeCv: !b.rubyIncludeCv })}
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
                          checked={b.rubyFormIds.includes(f.id)}
                          onChange={() => toggleRubyForm(i, f.id)}
                          className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                        />
                        {f.name}
                      </label>
                    ))
                  )}
                </div>
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  Ruby compares these against the job description to build screening questions.
                </span>
              </div>

              {/* What to compare to — documents (policies/contracts) for this step.
                  Blank = the company default from Settings. The role's own job
                  description is always compared automatically. */}
              <div className="text-xs font-medium text-gray-600">
                What to compare to
                {rubyDocs.length === 0 ? (
                  <p className="mt-1 font-normal text-gray-400">No policies or contracts yet — add them in Settings first.</p>
                ) : (
                  <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 backdrop-blur-sm p-2">
                    {rubyDocs.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                        <input
                          type="checkbox"
                          checked={b.rubyDocumentIds.includes(d.id)}
                          onChange={() => toggleRubyDoc(i, d.id)}
                          className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                        />
                        {d.name}
                      </label>
                    ))}
                  </div>
                )}
                <span className="mt-1 block text-[11px] font-normal text-gray-400">
                  Policies / contracts to judge the candidate against. Leave blank to use your Settings default. The role&apos;s job description is always compared.
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

          {/* Due / required don't apply to the Ruby step. */}
          {b.taskType !== "ruby" && (
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
        {saving ? (appendMode ? "Adding…" : "Creating…") : appendMode ? "Add to workflow" : "Create Workflow"}
      </button>
    </div>
  );
}
