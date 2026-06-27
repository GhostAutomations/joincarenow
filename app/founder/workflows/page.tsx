import { Eye, EyeOff } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import { WorkflowCard } from "@/components/dashboard/workflow-card";
import {
  addStoreWorkflowTasks,
  deleteStoreWorkflow,
  deleteStoreWorkflowStep,
  setStoreWorkflowPublished,
} from "@/modules/workflows/actions";

const TYPE_LABEL: Record<string, string> = { form: "Form", document: "Document upload", acknowledge: "Read & confirm" };
const TRIGGER_LABEL: Record<string, string> = {
  on_application: "On application",
  reviewing: "Under review",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
};

export default async function FounderWorkflowsPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: rows }, { data: forms }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, form_id, trigger_stage, required, due_days, position, workflow_id, workflow_name, store_published")
      .eq("is_store", true)
      .order("workflow_id", { ascending: true })
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("is_store", true).order("name", { ascending: true }),
  ]);

  type Row = {
    id: string; title: string; task_type: string; trigger_stage: string | null;
    required: boolean; due_days: number | null; workflow_id: string; workflow_name: string;
    store_published: boolean;
  };
  const map = new Map<string, { id: string; name: string; published: boolean; items: Row[] }>();
  for (const r of (rows ?? []) as Row[]) {
    const wf = map.get(r.workflow_id) ?? { id: r.workflow_id, name: r.workflow_name, published: r.store_published, items: [] };
    wf.items.push(r);
    map.set(r.workflow_id, wf);
  }
  const workflows = [...map.values()];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Workflows</h1>
      <p className="mt-1 text-sm text-white/80">
        Build reusable onboarding workflows from your store forms — the same builder companies use.
        Publish the ones you want to offer, then apply them when setting up a company. The company
        owns its copy; editing it there never changes your master here.
      </p>

      <section className="mt-6 rounded-2xl border border-white/40 bg-white/70 p-6 shadow-sm backdrop-blur-md">
        <h2 className="text-base font-medium text-gray-900">Your workflows</h2>
        <p className="mt-1 text-sm text-gray-500">Each is a checklist of tasks/forms, each sent at a chosen pipeline stage.</p>

        {workflows.length > 0 && (
          <div className="mt-4 space-y-3">
            {workflows.map((wf) => (
              <div key={wf.id} className="rounded-xl border border-white/40 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${wf.published ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                    {wf.published ? "Live" : "Draft"}
                  </span>
                  <form action={setStoreWorkflowPublished}>
                    <input type="hidden" name="workflowId" value={wf.id} />
                    <input type="hidden" name="publish" value={(!wf.published).toString()} />
                    <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      {wf.published ? <><EyeOff className="h-4 w-4" /> Unpublish</> : <><Eye className="h-4 w-4" /> Publish</>}
                    </button>
                  </form>
                </div>
                <WorkflowCard
                  name={wf.name}
                  subtitle={`${wf.items.length} task${wf.items.length === 1 ? "" : "s"}`}
                  workflowId={wf.id}
                  items={wf.items.map((t) => ({
                    id: t.id,
                    title: t.title,
                    meta:
                      (TYPE_LABEL[t.task_type] ?? t.task_type) +
                      (t.trigger_stage ? ` · ${TRIGGER_LABEL[t.trigger_stage] ?? t.trigger_stage}` : "") +
                      (t.due_days != null ? ` · due within ${t.due_days} day${t.due_days === 1 ? "" : "s"}` : "") +
                      (!t.required ? " · optional" : ""),
                  }))}
                  deleteWorkflow={deleteStoreWorkflow}
                  deleteTask={deleteStoreWorkflowStep}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Add a workflow</p>
          <AddTemplateTask
            forms={(forms ?? []) as { id: string; name: string }[]}
            roles={[]}
            saveAction={addStoreWorkflowTasks}
            showRole={false}
          />
        </div>
      </section>
    </div>
  );
}
