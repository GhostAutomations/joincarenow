import { Trash2 } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { deleteTemplateTask } from "@/modules/onboarding/actions";
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

  const [{ data: templates }, { data: forms }, { data: tasks }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, required, due_days, trigger_stage, position")
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase
      .from("onboarding_tasks")
      .select(
        "id, title, task_type, status, doc_path, note, required, due_date, applicant_id, applicants(first_name, last_name, email)"
      )
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
  ]);

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
    <div>
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

          {(templates ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100">
              {(templates ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{t.title}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {TYPE_LABEL[t.task_type] ?? t.task_type}
                      {t.trigger_stage && ` · ${TRIGGER_LABEL[t.trigger_stage] ?? t.trigger_stage}`}
                      {t.due_days != null && ` · due within ${t.due_days} day${t.due_days === 1 ? "" : "s"}`}
                      {!t.required && " · optional"}
                    </span>
                  </div>
                  <form action={deleteTemplateTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4">
            <AddTemplateTask forms={forms ?? []} />
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
