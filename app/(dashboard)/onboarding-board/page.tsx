import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { deleteTemplateTask, deleteWorkflow } from "@/modules/onboarding/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import { WorkflowCard } from "@/components/dashboard/workflow-card";

const TYPE_LABEL: Record<string, string> = {
  form: "Form", document: "Document", acknowledge: "Read & confirm",
};

const TRIGGER_LABEL: Record<string, string> = {
  on_application: "on application",
  reviewing: "at Reviewing",
  interview: "at Interview",
  offer: "at Offer",
  hired: "when Hired",
};

export default async function OnboardingBoardPage() {
  const { supabase, current } = await requireCompany();
  // Workflow (onboarding template builder) is admin-only configuration.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = current.role === "admin";

  const [{ data: templates }, { data: forms }, { data: roles }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, required, due_days, trigger_stage, role_id, workflow_id, workflow_name, position")
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name").eq("company_id", current.company_id).order("name"),
  ]);

  const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

  // Group template tasks into their workflows.
  type Tpl = {
    id: string;
    title: string;
    task_type: string;
    required: boolean;
    due_days: number | null;
    trigger_stage: string | null;
    role_id: string | null;
    workflow_id: string | null;
    workflow_name: string | null;
    position: number;
  };
  const wfMap = new Map<
    string,
    { id: string | null; name: string; role_id: string | null; items: Tpl[] }
  >();
  for (const t of (templates ?? []) as unknown as Tpl[]) {
    const wid = t.workflow_id ?? null;
    const key = wid ?? `solo-${t.id}`;
    const g =
      wfMap.get(key) ?? {
        id: wid,
        name: t.workflow_name ?? t.title,
        role_id: t.role_id ?? null,
        items: [],
      };
    g.items.push(t);
    wfMap.set(key, g);
  }
  const workflows = [...wfMap.values()];

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
                  subtitle={`${wf.role_id ? `${roleName.get(wf.role_id) ?? "role"} · ` : ""}${wf.items.length} task${wf.items.length === 1 ? "" : "s"}`}
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
                  deleteWorkflow={deleteWorkflow}
                  deleteTask={deleteTemplateTask}
                />
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
            <AddTemplateTask forms={forms ?? []} roles={roles ?? []} />
          </div>
        </section>
      )}

    </div>
  );
}
