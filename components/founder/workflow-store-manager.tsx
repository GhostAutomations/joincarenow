"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Eye, EyeOff, ChevronDown, ChevronUp } from "lucide-react";
import {
  createStoreWorkflow,
  addStoreWorkflowStep,
  deleteStoreWorkflowStep,
  deleteStoreWorkflow,
  setStoreWorkflowPublished,
  type WfState,
} from "@/modules/workflows/actions";

export type StoreFormOption = { id: string; name: string };
export type StoreStep = {
  id: string;
  title: string;
  taskType: string;
  formId: string | null;
  triggerStage: string | null;
  required: boolean;
  dueDays: number | null;
  body: string | null;
};
export type StoreWorkflow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  published: boolean;
  steps: StoreStep[];
};

const STAGE_LABEL: Record<string, string> = {
  on_application: "On application",
  reviewing: "Under review",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};
const TYPE_LABEL: Record<string, string> = {
  form: "Form",
  document: "Document upload",
  acknowledge: "Read & confirm",
};

const inputCls = "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none";
const labelCls = "block text-xs font-medium text-gray-600";

/** Shared step fields (used by both the new-workflow form and add-step form). */
function StepFields({ storeForms }: { storeForms: StoreFormOption[] }) {
  const [taskType, setTaskType] = useState("document");
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelCls}>Step title</label>
        <input name="title" className={inputCls} placeholder="e.g. Right to Work check" />
      </div>
      <div>
        <label className={labelCls}>Type</label>
        <select name="taskType" value={taskType} onChange={(e) => setTaskType(e.target.value)} className={inputCls}>
          <option value="document">Document upload</option>
          <option value="form">Form</option>
          <option value="acknowledge">Read & confirm</option>
        </select>
      </div>
      {taskType === "form" && (
        <div>
          <label className={labelCls}>Store form</label>
          <select name="formId" className={inputCls} defaultValue="">
            <option value="" disabled>Choose a form…</option>
            {storeForms.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          {storeForms.length === 0 && (
            <p className="mt-1 text-xs text-amber-700">No store forms yet — add some in the Form Store first.</p>
          )}
        </div>
      )}
      <div>
        <label className={labelCls}>Send at stage</label>
        <select name="triggerStage" className={inputCls} defaultValue="hired">
          {Object.entries(STAGE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelCls}>Due (days after start, optional)</label>
        <input name="dueDays" type="number" min={0} className={inputCls} placeholder="e.g. 3" />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" name="required" defaultChecked className="h-4 w-4 rounded border-gray-300" />
        Required
      </label>
      <div className="sm:col-span-2">
        <label className={labelCls}>Instructions / text to confirm (optional)</label>
        <textarea name="body" rows={2} className={inputCls} placeholder="Shown to the applicant for this step." />
      </div>
    </div>
  );
}

function NewWorkflowForm({ storeForms }: { storeForms: StoreFormOption[] }) {
  const router = useRouter();
  const [state, action] = useActionState<WfState, FormData>(createStoreWorkflow, undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state?.ok) { router.refresh(); setOpen(false); }
  }, [state, router]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> New workflow
      </button>
    );
  }

  return (
    <form action={action} className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
      <h2 className="text-base font-semibold text-gray-900">New workflow</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Workflow name</label>
          <input name="workflowName" className={inputCls} placeholder="e.g. Standard care onboarding" />
        </div>
        <div>
          <label className={labelCls}>Category (optional)</label>
          <input name="category" className={inputCls} placeholder="e.g. Onboarding" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Description (optional)</label>
          <input name="description" className={inputCls} placeholder="Short summary shown in company setup." />
        </div>
      </div>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-gray-500">First step</p>
      <div className="mt-2">
        <StepFields storeForms={storeForms} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Create workflow
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function AddStepForm({ workflowId, storeForms }: { workflowId: string; storeForms: StoreFormOption[] }) {
  const router = useRouter();
  const [state, action] = useActionState<WfState, FormData>(addStoreWorkflowStep, undefined);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (state?.ok) { router.refresh(); setOpen(false); }
  }, [state, router]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
        <Plus className="h-4 w-4" /> Add step
      </button>
    );
  }
  return (
    <form action={action} className="mt-3 rounded-xl border border-gray-200 bg-white/80 p-4">
      <input type="hidden" name="workflowId" value={workflowId} />
      <StepFields storeForms={storeForms} />
      <div className="mt-3 flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Add step</button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function WorkflowCard({ wf, storeForms }: { wf: StoreWorkflow; storeForms: StoreFormOption[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900">{wf.name}</h3>
            {wf.published ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">Live</span>
            ) : (
              <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600">Draft</span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-500">
            {wf.category ? `${wf.category} · ` : ""}{wf.steps.length} step{wf.steps.length === 1 ? "" : "s"}
            {wf.description ? ` · ${wf.description}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <form action={setStoreWorkflowPublished}>
            <input type="hidden" name="workflowId" value={wf.id} />
            <input type="hidden" name="publish" value={(!wf.published).toString()} />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
              {wf.published ? <><EyeOff className="h-4 w-4" /> Unpublish</> : <><Eye className="h-4 w-4" /> Publish</>}
            </button>
          </form>
          <form action={deleteStoreWorkflow}>
            <input type="hidden" name="workflowId" value={wf.id} />
            <button className="rounded-lg border border-red-200 bg-white p-1.5 text-red-600 hover:bg-red-50" title="Delete workflow">
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <button onClick={() => setExpanded((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900">
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        {expanded ? "Hide steps" : "Show steps"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-2">
          {wf.steps.map((s, i) => (
            <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white/80 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{i + 1}. {s.title}</p>
                <p className="text-xs text-gray-500">
                  {TYPE_LABEL[s.taskType] ?? s.taskType} · {STAGE_LABEL[s.triggerStage ?? ""] ?? s.triggerStage}
                  {s.required ? " · Required" : " · Optional"}
                  {s.dueDays != null ? ` · due +${s.dueDays}d` : ""}
                </p>
              </div>
              <form action={deleteStoreWorkflowStep}>
                <input type="hidden" name="stepId" value={s.id} />
                <button className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" title="Remove step">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </div>
          ))}
          <AddStepForm workflowId={wf.id} storeForms={storeForms} />
        </div>
      )}
    </div>
  );
}

export function WorkflowStoreManager({
  workflows,
  storeForms,
}: {
  workflows: StoreWorkflow[];
  storeForms: StoreFormOption[];
}) {
  return (
    <div className="space-y-4">
      <NewWorkflowForm storeForms={storeForms} />
      {workflows.length === 0 ? (
        <div className="rounded-2xl border border-white/40 bg-white/60 p-8 text-center text-sm text-gray-600 backdrop-blur">
          No workflows yet. Create one above — build it from your store forms, then publish it to make
          it selectable when setting up a company.
        </div>
      ) : (
        workflows.map((wf) => <WorkflowCard key={wf.id} wf={wf} storeForms={storeForms} />)
      )}
    </div>
  );
}
