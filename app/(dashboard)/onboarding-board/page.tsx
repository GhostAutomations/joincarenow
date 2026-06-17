import { Trash2 } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { deleteTemplateTask, deleteWorkflow } from "@/modules/onboarding/actions";
import { PageHeader } from "@/components/dashboard/page-header";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import {
  OnboardingTaskReview,
  type OnbTask,
} from "@/components/dashboard/onboarding-task-review";

type TaskRow = OnbTask & {
  applicant_id: string;
  applicants: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

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
  const isAdmin = current.role === "admin";

  const [{ data: templates }, { data: forms }, { data: roles }, { data: tasks }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, required, due_days, trigger_stage, role_id, workflow_id, workflow_name, position")
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase
      .from("onboarding_tasks")
      .select(
        "id, title, task_type, status, doc_path, note, required, due_date, applicant_id, applicants(first_name, last_name, email)"
      )
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
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

  // Group tasks by person.
  const byPerson = new Map<string, { name: string; tasks: OnbTask[] }>();
  for (const t of (tasks ?? []) as unknown as TaskRow[]) {
    const name =
      [t.applicants?.first_name, t.applicants?.last_name].filter(Boolean).join(" ") ||
      t.applicants?.email ||
      "New starter";
    const entry = byPerson.get(t.applicant_id) ?? { name, tasks: [] };
    entry.tasks.push(t);
    byPerson.set(t.applicant_id, entry);
  }
  const people = [...byPerson.values()];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Workflow"
        subtitle="Build a checklist of tasks and forms, and choose the point in the pipeline each one is sent to the applicant."
      />

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Workflow checklist</h2>
          <p className="mt-1 text-sm text-gray-500">
            Each task is sent automatically when an applicant reaches its trigger point.
          </p>

          {workflows.length > 0 && (
            <div className="mt-4 space-y-3">
              {workflows.map((wf, gi) => (
                <div key={gi} className="rounded-lg border border-gray-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-semibold text-gray-900">{wf.name}</span>
                      <span className="ml-2 text-xs text-gray-400">
                        {wf.role_id ? `${roleName.get(wf.role_id) ?? "role"} · ` : ""}
                        {wf.items.length} task{wf.items.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {wf.id && (
                      <form action={deleteWorkflow}>
                        <input type="hidden" name="workflowId" value={wf.id} />
                        <button className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-xs text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete workflow">
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </form>
                    )}
                  </div>
                  <ul className="mt-2 divide-y divide-gray-100">
                    {wf.items.map((t) => (
                      <li key={t.id} className="flex items-center justify-between py-2">
                        <div>
                          <span className="text-sm text-gray-800">{t.title}</span>
                          <span className="ml-2 text-xs text-gray-400">
                            {TYPE_LABEL[t.task_type] ?? t.task_type}
                            {t.trigger_stage && ` · ${TRIGGER_LABEL[t.trigger_stage] ?? t.trigger_stage}`}
                            {t.due_days != null && ` · due within ${t.due_days} day${t.due_days === 1 ? "" : "s"}`}
                            {!t.required && " · optional"}
                          </span>
                        </div>
                        <form action={deleteTemplateTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove task">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
            <AddTemplateTask forms={forms ?? []} roles={roles ?? []} />
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-medium text-gray-900">Applicants with tasks</h2>
          <div className="mt-4 space-y-4">
            {people.map((p, i) => {
              const done = p.tasks.filter((t) => t.status === "approved").length;
              return (
                <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">{p.name}</h3>
                    <span className="text-xs text-gray-500">
                      {done}/{p.tasks.length} complete
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {p.tasks.map((t) => (
                      <OnboardingTaskReview key={t.id} task={t} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
