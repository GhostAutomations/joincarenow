"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Trash2, Pencil, Check, X, ArrowUp, ArrowDown } from "lucide-react";

export type WorkflowTask = {
  id: string;
  title: string;
  task_type: string;
  trigger_stage: string | null;
  due_days: number | null;
  required: boolean;
  body: string | null;
  form_id: string | null;
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
};

const TYPE_LABEL: Record<string, string> = {
  form: "Form", document: "Document upload", acknowledge: "Read & confirm",
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
  deleteWorkflow,
  deleteTask,
  updateTask,
  renameWorkflow,
  reorderTasks,
  roleControl,
}: {
  name: string;
  subtitle: string;
  workflowId: string | null;
  items: WorkflowTask[];
  forms?: { id: string; name: string }[];
  deleteWorkflow: (formData: FormData) => void | Promise<void>;
  deleteTask: (formData: FormData) => void | Promise<void>;
  updateTask: (input: EditInput) => Promise<{ ok?: boolean; error?: string }>;
  renameWorkflow: (workflowId: string, name: string) => Promise<{ ok?: boolean; error?: string }>;
  reorderTasks: (ids: string[]) => Promise<{ ok?: boolean }>;
  /** Multi-select role association. Company: role UUIDs. Founder: standard names. */
  roleControl?: {
    options: { value: string; label: string }[];
    selected: string[];
    save: (values: string[]) => Promise<{ ok?: boolean; error?: string }>;
    label?: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameV, setNameV] = useState(name);
  const [edit, setEdit] = useState<EditInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [roleSel, setRoleSel] = useState<string[]>(roleControl?.selected ?? []);
  const [roleDirty, setRoleDirty] = useState(false);

  function toggleRole(value: string) {
    setRoleDirty(true);
    setRoleSel((rs) => (rs.includes(value) ? rs.filter((v) => v !== value) : [...rs, value]));
  }
  async function saveRoles() {
    if (!roleControl) return;
    setBusy(true); setErr(null);
    const res = await roleControl.save(roleSel);
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
    <div className="rounded-lg border border-white/50 bg-white/50 backdrop-blur-sm shadow-sm">
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
            <button type="button" onClick={() => { setEditingName(false); setNameV(name); }} className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Cancel"><X className="h-4 w-4" /></button>
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
                <button type="button" onClick={() => { setEditingName(true); setNameV(name); setErr(null); }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700" aria-label="Rename workflow">
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-600">{roleControl.label ?? "Applies to roles"}</span>
                {roleDirty && (
                  <button type="button" onClick={saveRoles} disabled={busy} className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60">
                    {busy ? "Saving…" : "Save roles"}
                  </button>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {roleControl.options.map((r) => (
                  <label key={r.value} className="flex items-center gap-1.5 text-sm text-gray-700">
                    <input type="checkbox" checked={roleSel.includes(r.value)} onChange={() => toggleRole(r.value)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                    {r.label}
                  </label>
                ))}
              </div>
              <span className="mt-1 block text-[11px] text-gray-400">None selected = applies to all roles.</span>
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
                    <button type="button" onClick={() => startEdit(t)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Edit task"><Pencil className="h-3.5 w-3.5" /></button>
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
                        </select>
                      </label>
                      <label className="text-xs font-medium text-gray-600">Send when…
                        <select value={edit.triggerStage} onChange={(e) => setEdit({ ...edit, triggerStage: e.target.value })} className={fieldCls}>
                          <option value="" disabled>Select one…</option>
                          {STAGE_OPTIONS.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                        </select>
                      </label>
                    </div>

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
                        <input type="checkbox" checked={edit.required} onChange={(e) => setEdit({ ...edit, required: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                        Required
                      </label>
                    </div>

                    <label className="mt-3 block text-xs font-medium text-gray-600">Instructions (optional)
                      <textarea value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} rows={2} className={fieldCls} />
                    </label>

                    <div className="mt-3 flex justify-end gap-2">
                      <button type="button" onClick={() => setEdit(null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
                      <button type="button" onClick={saveEdit} disabled={busy} className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
