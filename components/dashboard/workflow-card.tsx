"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2, Pencil, Check, X, ArrowUp, ArrowDown, Plus } from "lucide-react";
import { MultiSelect } from "@/components/dashboard/multi-select";
import { RUBY_FOCUS_OPTIONS } from "@/lib/ruby/config";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import type { TaskDraft } from "@/modules/onboarding/actions";

export type WorkflowTask = {
  id: string;
  title: string;
  task_type: string;
  trigger_stage: string | null;
  due_days: number | null;
  required: boolean;
  body: string | null;
  form_id: string | null;
  ruby_engage?: string | null;
  ruby_form_ids?: string[] | null;
  ruby_include_cv?: boolean | null;
  ruby_focus?: string[] | null;
  ruby_instructions?: string | null;
  ruby_question_count?: number | null;
  ruby_document_ids?: string[] | null;
};

type EditInput = {
  id: string;
  title: string;
  taskType: string;
  triggerStage: string;
  dueDays: string;
  required: boolean;
  body: string;
  formId: string;
  rubyEngage: string;
  rubyFormIds: string[];
  rubyIncludeCv: boolean;
  rubyFocus: string[];
  rubyInstructions: string;
  rubyQuestionCount: string;
  rubyDocumentIds: string[];
};

const RUBY_STAGE_OPTIONS: [string, string][] = [
  ["on_application", "Application submitted"],
  ["reviewing", "Reviewing"],
  ["interview", "Interview"],
  ["right_to_work", "Right to work"],
  ["offer", "Offer"],
  ["hired", "Hired"],
];

const TYPE_LABEL: Record<string, string> = {
  form: "Form", document: "Document upload", acknowledge: "Read & confirm", ruby: "Ruby AI screening",
};
const TRIGGER_LABEL: Record<string, string> = {
  on_application: "On application", reviewing: "Under review", interview: "Interview", offer: "Offer", hired: "Hired",
};
const STAGE_OPTIONS: [string, string][] = [
  ["on_application", "They submit their application"],
  ["reviewing", "They reach Reviewing"],
  ["interview", "They reach Interview"],
  ["offer", "They reach Offer"],
  ["hired", "They are Hired"],
];

const fieldCls =
  "mt-1 block w-full rounded-md border border-white/60 bg-white/70 backdrop-blur-sm px-2 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function metaFor(t: WorkflowTask): string {
  return (
    (TYPE_LABEL[t.task_type] ?? t.task_type) +
    (t.trigger_stage ? ` · ${TRIGGER_LABEL[t.trigger_stage] ?? t.trigger_stage}` : "") +
    (t.due_days != null ? ` · due within ${t.due_days} day${t.due_days === 1 ? "" : "s"}` : "") +
    (!t.required ? " · optional" : "")
  );
}

/** Collapsible, editable workflow card on the Workflow board / Founder store.
 *  Edit each task, rename the workflow, reorder tasks, and (company only,
 *  when role controls are provided) change which role it applies to. */
export function WorkflowCard({
  name,
  subtitle,
  workflowId,
  items,
  forms = [],
  rubyDocs = [],
  deleteWorkflow,
  deleteTask,
  updateTask,
  renameWorkflow,
  reorderTasks,
  roleControl,
  rubyEnabled = false,
  addTasks,
}: {
  name: string;
  subtitle: string;
  workflowId: string | null;
  items: WorkflowTask[];
  forms?: { id: string; name: string }[];
  rubyDocs?: { id: string; name: string }[];
  rubyEnabled?: boolean;
  deleteWorkflow: (formData: FormData) => void | Promise<void>;
  deleteTask: (formData: FormData) => void | Promise<void>;
  updateTask: (input: EditInput) => Promise<{ ok?: boolean; error?: string }>;
  renameWorkflow: (workflowId: string, name: string) => Promise<{ ok?: boolean; error?: string }>;
  reorderTasks: (ids: string[]) => Promise<{ ok?: boolean }>;
  /** Multi-select role association. Company: role UUIDs. Founder: standard names. */
  roleControl?: {
    options: { value: string; label: string }[];
    selected: string[];
    /** Raw server action — must be passed directly (not wrapped in a closure). */
    save: (workflowId: string, values: string[]) => Promise<{ ok?: boolean; error?: string }>;
    label?: string;
  };
  /** Company only: append tasks to this existing workflow. */
  addTasks?: (workflowId: string, drafts: TaskDraft[]) => Promise<{ ok?: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameV, setNameV] = useState(name);
  const [edit, setEdit] = useState<EditInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roleSel, setRoleSel] = useState<string[]>(roleControl?.selected ?? []);
  const [roleDirty, setRoleDirty] = useState(false);

  async function saveRoles() {
    if (!roleControl || !workflowId) return;
    setBusy(true); setErr(null);
    const res = await roleControl.save(workflowId, roleSel);
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    setRoleDirty(false);
    router.refresh();
  }

  async function move(index: number, dir: -1 | 1) {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const order = items.map((t) => t.id);
    [order[index], order[j]] = [order[j], order[index]];
    setBusy(true);
    await reorderTasks(order);
    setBusy(false);
    router.refresh();
  }

  function startEdit(t: WorkflowTask) {
    setErr(null);
    setEdit({
      id: t.id,
      title: t.title,
      taskType: t.task_type,
      triggerStage: t.trigger_stage ?? "",
      dueDays: t.due_days != null ? String(t.due_days) : "",
      required: t.required,
      body: t.body ?? "",
      formId: t.form_id ?? "",
      rubyEngage: t.ruby_engage ?? "",
      rubyFormIds: t.ruby_form_ids ?? [],
      rubyIncludeCv: t.ruby_include_cv === true,
      rubyFocus: t.ruby_focus ?? [],
      rubyInstructions: t.ruby_instructions ?? "",
      rubyQuestionCount: t.ruby_question_count != null ? String(t.ruby_question_count) : "",
      rubyDocumentIds: t.ruby_document_ids ?? [],
    });
  }

  function toggleEditRubyForm(id: string) {
    if (!edit) return;
    setEdit({
      ...edit,
      rubyFormIds: edit.rubyFormIds.includes(id)
        ? edit.rubyFormIds.filter((x) => x !== id)
        : [...edit.rubyFormIds, id],
    });
  }

  async function saveEdit() {
    if (!edit) return;
    setBusy(true); setErr(null);
    const res = await updateTask(edit);
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    setEdit(null);
    router.refresh();
  }

  async function saveName() {
    if (!workflowId) return;
    setBusy(true); setErr(null);
    const res = await renameWorkflow(workflowId, nameV);
    setBusy(false);
    if (res?.error) { setErr(res.error); return; }
    setEditingName(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 backdrop-blur-md shadow-sm">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
        {editingName ? (
          <div className="flex flex-1 items-center gap-1.5">
            <input
              value={nameV}
              onChange={(e) => setNameV(e.target.value)}
              autoFocus
              className="flex-1 rounded-md border border-white/60 bg-white/80 px-2 py-1 text-sm text-gray-900"
            />
            <button type="button" onClick={saveName} disabled={busy} className="rounded p-1 text-green-600 hover:bg-green-50" aria-label="Save name"><Check className="h-4 w-4" /></button>
            <button type="button" onClick={() => { setEditingName(false); setNameV(name); }} className="rounded p-1 text-gray-400 hover:bg-white/70" aria-label="Cancel"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <>
            <button onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={open}>
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
              <span className="truncate text-sm font-semibold text-gray-900">{name}</span>
              <span className="shrink-0 text-xs text-gray-400">{subtitle}</span>
            </button>
            <div className="flex shrink-0 items-center gap-1">
              {workflowId && (
                <button type="button" onClick={() => { setEditingName(true); setNameV(name); setErr(null); }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-white/70 hover:text-gray-700" aria-label="Rename workflow">
                  <Pencil className="h-3.5 w-3.5" /> Rename
                </button>
              )}
              {workflowId && (
                <form action={deleteWorkflow}>
                  <input type="hidden" name="workflowId" value={workflowId} />
                  <button className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete workflow">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {err && <p className="px-3 pb-2 text-xs text-red-600">{err}</p>}

      {open && (
        <>
          {workflowId && roleControl && (
            <div className="border-t border-white/50 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-xs font-medium text-gray-600">{roleControl.label ?? "Applies to roles"}</span>
                <MultiSelect
                  options={roleControl.options}
                  selected={roleSel}
                  onChange={(vals) => { setRoleSel(vals); setRoleDirty(true); }}
                  allLabel="All roles"
                  className="max-w-xs flex-1"
                />
                {roleDirty && (
                  <button type="button" onClick={saveRoles} disabled={busy} className="shrink-0 rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                    {busy ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
            </div>
          )}

          <ul className="divide-y divide-white/50 border-t border-white/50 px-3">
            {items.map((t, i) => (
              <li key={t.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1">
                    {items.length > 1 && (
                      <span className="flex flex-col">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0 || busy} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1 || busy} className="text-gray-400 hover:text-gray-700 disabled:opacity-30" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800">{t.title}</span>
                      <span className="ml-2 text-xs text-gray-400">{metaFor(t)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => startEdit(t)} className="rounded p-1 text-gray-400 hover:bg-white/70 hover:text-gray-700" aria-label="Edit task"><Pencil className="h-3.5 w-3.5" /></button>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove task"><Trash2 className="h-3.5 w-3.5" /></button>
                    </form>
                  </div>
                </div>

                {edit?.id === t.id && (
                  <div className="mt-2 rounded-lg border border-white/60 bg-white/60 backdrop-blur-sm p-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs font-medium text-gray-600">Type
                        <select value={edit.taskType} onChange={(e) => setEdit({ ...edit, taskType: e.target.value })} className={fieldCls}>
                          <option value="document">Upload a document</option>
                          <option value="form">Fill in a form</option>
                          <option value="acknowledge">Read &amp; confirm</option>
                          {(rubyEnabled || edit.taskType === "ruby") && <option value="ruby">Ruby AI screening</option>}
                        </select>
                      </label>
                      {edit.taskType === "ruby" ? (
                        <label className="text-xs font-medium text-gray-600">When should Ruby engage?
                          <select value={edit.rubyEngage} onChange={(e) => setEdit({ ...edit, rubyEngage: e.target.value })} className={fieldCls}>
                            <option value="" disabled>Select one…</option>
                            <option value="all_forms">When the selected forms are complete</option>
                            <option value="as_forms">As the selected forms come in</option>
                            <option value="stage">When they reach a pipeline stage</option>
                          </select>
                        </label>
                      ) : (
                        <label className="text-xs font-medium text-gray-600">Send when…
                          <select value={edit.triggerStage} onChange={(e) => setEdit({ ...edit, triggerStage: e.target.value })} className={fieldCls}>
                            <option value="" disabled>Select one…</option>
                            {STAGE_OPTIONS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                          </select>
                        </label>
                      )}
                    </div>

                    {edit.taskType === "ruby" ? (
                      <>
                        {edit.rubyEngage === "stage" && (
                          <label className="mt-3 block text-xs font-medium text-gray-600">Which stage?
                            <select value={edit.triggerStage} onChange={(e) => setEdit({ ...edit, triggerStage: e.target.value })} className={fieldCls}>
                              <option value="" disabled>Select one…</option>
                              {RUBY_STAGE_OPTIONS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                            </select>
                          </label>
                        )}
                        <div className="mt-3 text-xs font-medium text-gray-600">Forms Ruby reviews
                          <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 backdrop-blur-sm p-2">
                            <label className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                              <input type="checkbox" checked={edit.rubyIncludeCv} onChange={() => setEdit({ ...edit, rubyIncludeCv: !edit.rubyIncludeCv })} className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500" />
                              CV (uploaded)
                            </label>
                            {forms.length === 0 ? (
                              <p className="px-1 font-normal text-gray-400">No forms yet.</p>
                            ) : (
                              forms.map((f) => (
                                <label key={f.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                                  <input type="checkbox" checked={edit.rubyFormIds.includes(f.id)} onChange={() => toggleEditRubyForm(f.id)} className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500" />
                                  {f.name}
                                </label>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Overrides — leave blank to use the company Settings defaults. */}
                        <div className="mt-3 rounded-md border border-white/60 bg-white/50 p-2">
                          <p className="text-xs font-semibold text-gray-700">Override for this step <span className="font-normal text-gray-400">(optional — blank = company default)</span></p>
                          <div className="mt-2 text-xs font-medium text-gray-600">Focus areas
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {RUBY_FOCUS_OPTIONS.map((f) => {
                                const on = edit.rubyFocus.includes(f);
                                return (
                                  <button
                                    key={f}
                                    type="button"
                                    onClick={() => setEdit({ ...edit, rubyFocus: on ? edit.rubyFocus.filter((x) => x !== f) : [...edit.rubyFocus, f] })}
                                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${on ? "border-brand-600 bg-brand-600 text-white" : "border-white/60 bg-white/70 text-gray-700 hover:bg-white/90"}`}
                                  >
                                    {f}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          <label className="mt-2 block text-xs font-medium text-gray-600">Custom instructions
                            <textarea rows={2} value={edit.rubyInstructions} onChange={(e) => setEdit({ ...edit, rubyInstructions: e.target.value })} placeholder="Specific to this step — e.g. confirm driving licence for this role." className={fieldCls} />
                          </label>
                          <label className="mt-2 block text-xs font-medium text-gray-600">Number of questions
                            <input type="number" min="1" max="20" value={edit.rubyQuestionCount} onChange={(e) => setEdit({ ...edit, rubyQuestionCount: e.target.value })} placeholder="default" className={`${fieldCls} w-28`} />
                          </label>
                          <div className="mt-2 text-xs font-medium text-gray-600">What to compare to
                            {rubyDocs.length === 0 ? (
                              <p className="mt-1 font-normal text-gray-400">No policies or contracts yet.</p>
                            ) : (
                              <div className="mt-1 max-h-36 space-y-1 overflow-y-auto rounded-md border border-white/60 bg-white/60 p-2">
                                {rubyDocs.map((d) => {
                                  const on = edit.rubyDocumentIds.includes(d.id);
                                  return (
                                    <label key={d.id} className="flex items-center gap-2 rounded px-1 py-1 font-normal text-gray-700 hover:bg-white/60">
                                      <input
                                        type="checkbox"
                                        checked={on}
                                        onChange={() => setEdit({ ...edit, rubyDocumentIds: on ? edit.rubyDocumentIds.filter((x) => x !== d.id) : [...edit.rubyDocumentIds, d.id] })}
                                        className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                                      />
                                      {d.name}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                            <span className="mt-1 block text-[11px] font-normal text-gray-400">Blank = company default. The role&apos;s job description is always compared.</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {edit.taskType === "form" ? (
                          <label className="mt-3 block text-xs font-medium text-gray-600">Form
                            <select value={edit.formId} onChange={(e) => setEdit({ ...edit, formId: e.target.value })} className={fieldCls}>
                              <option value="">Select a form…</option>
                              {forms.map((f) => (<option key={f.id} value={f.id}>{f.name}</option>))}
                            </select>
                          </label>
                        ) : (
                          <label className="mt-3 block text-xs font-medium text-gray-600">Title
                            <input value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} className={fieldCls} />
                          </label>
                        )}

                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label className="text-xs font-medium text-gray-600">Due within (days)
                            <input value={edit.dueDays} onChange={(e) => setEdit({ ...edit, dueDays: e.target.value })} type="number" min="0" placeholder="e.g. 7" className={fieldCls} />
                          </label>
                          <label className="mt-5 flex items-center gap-2 text-sm text-gray-700">
                            <input type="checkbox" checked={edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} className="h-4 w-4 rounded border-white/40 text-brand-600" />
                            Required
                          </label>
                        </div>
                      </>
                    )}

                    <label className="mt-3 block text-xs font-medium text-gray-600">Instructions (optional)
                      <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={2} className={fieldCls} />
                    </label>

                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/60">Cancel</button>
                      <button type="button" onClick={saveEdit} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>

          {workflowId && addTasks && (
            <div className="border-t border-white/50 px-3 py-3">
              {adding ? (
                <div className="rounded-lg border border-dashed border-white/50 p-3">
                  <AddTemplateTask
                    forms={forms}
                    rubyDocs={rubyDocs}
                    rubyEnabled={rubyEnabled}
                    appendMode
                    saveAction={(drafts) => addTasks(workflowId, drafts)}
                  />
                  <button type="button" onClick={() => setAdding(false)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">
                    Close
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/60 bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/90"
                >
                  <Plus className="h-4 w-4" /> Add task
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
