import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import { WorkflowCard } from "@/components/dashboard/workflow-card";
import { ArchiveWorkflowButton } from "@/components/founder/archive-workflow-button";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import {
  addStoreWorkflowTasks,
  deleteStoreWorkflow,
  deleteStoreWorkflowStep,
  setStoreWorkflowPublished,
  unarchiveStoreWorkflow,
  updateStoreWorkflowStep,
  renameStoreWorkflow,
  reorderStoreWorkflowSteps,
  setStoreWorkflowRoleNames,
} from "@/modules/workflows/actions";
import type { WorkflowTask } from "@/components/dashboard/workflow-card";
import { DEFAULT_ROLES } from "@/lib/setup/starter-pack";

const STANDARD_ROLE_OPTIONS = DEFAULT_ROLES.map((r) => ({ value: r.name, label: r.name }));

export default async function FounderWorkflowsPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: rows }, { data: forms }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, form_id, body, trigger_stage, required, due_days, position, workflow_id, workflow_name, store_published, store_archived, store_folder, role_names")
      .eq("is_store", true)
      .order("workflow_id", { ascending: true })
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("is_store", true).order("name", { ascending: true }),
  ]);

  type Row = {
    id: string; title: string; task_type: string; trigger_stage: string | null;
    required: boolean; due_days: number | null; body: string | null; form_id: string | null;
    workflow_id: string; workflow_name: string;
    store_published: boolean; store_archived: boolean; store_folder: string | null;
    role_names: string[] | null;
  };
  const toTasks = (rs: Row[]): WorkflowTask[] => rs.map((t) => ({
    id: t.id, title: t.title, task_type: t.task_type, trigger_stage: t.trigger_stage,
    due_days: t.due_days, required: t.required, body: t.body, form_id: t.form_id,
  }));
  type Wf = { id: string; name: string; published: boolean; archived: boolean; folder: string | null; roleNames: string[]; items: Row[] };
  const map = new Map<string, Wf>();
  for (const r of (rows ?? []) as Row[]) {
    const wf = map.get(r.workflow_id) ?? {
      id: r.workflow_id, name: r.workflow_name, published: r.store_published,
      archived: r.store_archived, folder: r.store_folder, roleNames: r.role_names ?? [], items: [],
    };
    wf.items.push(r);
    map.set(r.workflow_id, wf);
  }
  const allWorkflows = [...map.values()];
  const workflows = allWorkflows.filter((w) => !w.archived);
  const archived = allWorkflows.filter((w) => w.archived);

  // Existing folder names (for the archive dialog) + archived grouped by folder.
  const folders = [...new Set(archived.map((w) => w.folder || "Unfiled"))].sort((a, b) => a.localeCompare(b));
  const archivedByFolder = new Map<string, Wf[]>();
  for (const w of archived) {
    const key = w.folder || "Unfiled";
    archivedByFolder.set(key, [...(archivedByFolder.get(key) ?? []), w]);
  }

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
                  <div className="flex items-center gap-2">
                    <ArchiveWorkflowButton workflowId={wf.id} folders={folders} />
                    <form action={setStoreWorkflowPublished}>
                      <input type="hidden" name="workflowId" value={wf.id} />
                      <input type="hidden" name="publish" value={(!wf.published).toString()} />
                      <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white/70 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">
                        {wf.published ? <><EyeOff className="h-4 w-4" /> Unpublish</> : <><Eye className="h-4 w-4" /> Publish</>}
                      </button>
                    </form>
                  </div>
                </div>
                <WorkflowCard
                  name={wf.name}
                  subtitle={`${wf.items.length} task${wf.items.length === 1 ? "" : "s"}`}
                  workflowId={wf.id}
                  items={toTasks(wf.items)}
                  forms={(forms ?? []) as { id: string; name: string }[]}
                  deleteWorkflow={deleteStoreWorkflow}
                  deleteTask={deleteStoreWorkflowStep}
                  updateTask={updateStoreWorkflowStep}
                  renameWorkflow={renameStoreWorkflow}
                  reorderTasks={reorderStoreWorkflowSteps}
                  roleControl={{
                    options: STANDARD_ROLE_OPTIONS,
                    selected: wf.roleNames,
                    save: (vals) => setStoreWorkflowRoleNames(wf.id, vals),
                    label: "Applies to roles (standard)",
                  }}
                />
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Add a workflow</p>
          <AddTemplateTask
            forms={(forms ?? []) as { id: string; name: string }[]}
            roleOptions={STANDARD_ROLE_OPTIONS}
            roleLabel="Applies to roles (standard)"
            saveAction={addStoreWorkflowTasks}
          />
        </div>
      </section>

      {archived.length > 0 && (
        <section className="mt-6 rounded-2xl border border-white/40 bg-white/70 p-6 shadow-sm backdrop-blur-md">
          <h2 className="text-base font-medium text-gray-900">Archived</h2>
          <p className="mt-1 text-sm text-gray-500">
            Organised in folders, hidden from company setup. Restore one to make it available again.
          </p>

          <div className="mt-4 space-y-3">
            {[...archivedByFolder.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([folder, list]) => (
              <CollapsibleSection key={folder} title={folder} count={list.length}>
                <div className="space-y-3">
                  {list.map((wf) => (
                    <div key={wf.id} className="rounded-xl border border-white/40 p-3">
                      <div className="mb-2 flex items-center justify-end">
                        <form action={unarchiveStoreWorkflow}>
                          <input type="hidden" name="workflowId" value={wf.id} />
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white/70 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">
                            <RotateCcw className="h-4 w-4" /> Restore
                          </button>
                        </form>
                      </div>
                      <WorkflowCard
                        name={wf.name}
                        subtitle={`${wf.items.length} task${wf.items.length === 1 ? "" : "s"}`}
                        workflowId={wf.id}
                        items={toTasks(wf.items)}
                        forms={(forms ?? []) as { id: string; name: string }[]}
                        deleteWorkflow={deleteStoreWorkflow}
                        deleteTask={deleteStoreWorkflowStep}
                        updateTask={updateStoreWorkflowStep}
                        renameWorkflow={renameStoreWorkflow}
                        reorderTasks={reorderStoreWorkflowSteps}
                        roleControl={{
                          options: STANDARD_ROLE_OPTIONS,
                          selected: wf.roleNames,
                          save: (vals) => setStoreWorkflowRoleNames(wf.id, vals),
                          label: "Applies to roles (standard)",
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
