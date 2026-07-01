import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import {
  deleteTemplateTask,
  deleteWorkflow,
  updateTemplateTask,
  renameWorkflow,
  reorderTemplateTasks,
  setWorkflowRoles,
} from "@/modules/onboarding/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import { WorkflowCard, type WorkflowTask } from "@/components/dashboard/workflow-card";

export default async function OnboardingBoardPage() {
  const { supabase, current } = await requireCompany();
  // Workflow (onboarding template builder) is admin-only configuration.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = current.role === "admin";

  const [{ data: templates }, { data: forms }, { data: roles }, { data: company }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, required, due_days, trigger_stage, body, form_id, role_id, role_ids, workflow_id, workflow_name, position, poppy_engage, poppy_form_ids, poppy_include_cv")
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name").eq("company_id", current.company_id).order("position").order("name"),
    supabase.from("companies").select("poppy_enabled").eq("id", current.company_id).single(),
  ]);
  const poppyEnabled = company?.poppy_enabled === true;

  const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  // Group template tasks into their workflows.
  type Tpl = {
    id: string;
    title: string;
    task_type: string;
    required: boolean;
    due_days: number | null;
    trigger_stage: string | null;
    body: string | null;
    form_id: string | null;
    role_id: string | null;
    role_ids: string[] | null;
    workflow_id: string | null;
    workflow_name: string | null;
    position: number;
    poppy_engage: string | null;
    poppy_form_ids: string[] | null;
    poppy_include_cv: boolean | null;
  };
  const toTasks = (ts: Tpl[]): WorkflowTask[] => ts.map((t) => ({
    id: t.id, title: t.title, task_type: t.task_type, trigger_stage: t.trigger_stage,
    due_days: t.due_days, required: t.required, body: t.body, form_id: t.form_id,
    poppy_engage: t.poppy_engage, poppy_form_ids: t.poppy_form_ids, poppy_include_cv: t.poppy_include_cv,
  }));
  const wfMap = new Map<
    string,
    { id: string | null; name: string; roleIds: string[]; items: Tpl[] }
  >();
  for (const t of (templates ?? []) as unknown as Tpl[]) {
    const wid = t.workflow_id ?? null;
    const key = wid ?? `solo-${t.id}`;
    // role_ids is the new set; fall back to legacy single role_id.
    const roleIds = (t.role_ids && t.role_ids.length ? t.role_ids : (t.role_id ? [t.role_id] : []));
    const g =
      wfMap.get(key) ?? {
        id: wid,
        name: t.workflow_name ?? t.title,
        roleIds,
        items: [],
      };
    g.items.push(t);
    wfMap.set(key, g);
  }
  const workflows = [...wfMap.values()];
  const roleOptions = (roles ?? []).map((r) => ({ value: String(r.id), label: String(r.name) }));
  const rolesLabel = (ids: string[]) =>
    ids.map((id) => roleName.get(id) ?? "role").join(", ");

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Workflow"
        subtitle="Build a checklist of tasks and forms, and choose the point in the pipeline each one is sent to the applicant."
      />

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Workflow checklist</h2>
          <p className="mt-1 text-sm text-gray-500">
            Each task is sent automatically when an applicant reaches its trigger point.
          </p>

          {workflows.length > 0 && (
            <div className="mt-4 space-y-3">
              {workflows.map((wf, gi) => (
                <WorkflowCard
                  key={gi}
                  name={wf.name}
                  subtitle={`${wf.roleIds.length ? `${rolesLabel(wf.roleIds)} · ` : ""}${wf.items.length} task${wf.items.length === 1 ? "" : "s"}`}
                  workflowId={wf.id}
                  items={toTasks(wf.items)}
                  forms={(forms ?? []) as { id: string; name: string }[]}
                  poppyEnabled={poppyEnabled}
                  deleteWorkflow={deleteWorkflow}
                  deleteTask={deleteTemplateTask}
                  updateTask={updateTemplateTask}
                  renameWorkflow={renameWorkflow}
                  reorderTasks={reorderTemplateTasks}
                  roleControl={wf.id ? {
                    options: roleOptions,
                    selected: wf.roleIds,
                    save: setWorkflowRoles,
                  } : undefined}
                />
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-white/40 p-4">
            <AddTemplateTask forms={forms ?? []} roleOptions={roleOptions} poppyEnabled={poppyEnabled} />
          </div>
        </section>
      )}

    </div>
  );
}
