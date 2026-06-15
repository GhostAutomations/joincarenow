import { Trash2 } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { deleteTemplateTask, setStartDate } from "@/modules/onboarding/actions";
import { AddTemplateTask } from "@/components/dashboard/add-template-task";
import {
  OnboardingTaskReview,
  type OnbTask,
} from "@/components/dashboard/onboarding-task-review";

type TaskRow = OnbTask & {
  applicant_id: string;
  application_id: string;
  due_days: number | null;
  due_direction: string;
  applicants: { first_name: string | null; last_name: string | null; email: string | null } | null;
  applications: { start_date: string | null } | null;
};

function computeDue(start: string | null, days: number | null, dir: string): string | null {
  if (!start || days == null) return null;
  const d = new Date(start);
  d.setDate(d.getDate() + (dir === "before" ? -days : days));
  return d.toISOString().slice(0, 10);
}

const TYPE_LABEL: Record<string, string> = {
  form: "Form", document: "Document", acknowledge: "Read & confirm",
};

export default async function OnboardingBoardPage() {
  const { supabase, current } = await requireCompany();
  const isAdmin = current.role === "admin";

  const [{ data: templates }, { data: forms }, { data: tasks }] = await Promise.all([
    supabase
      .from("onboarding_templates")
      .select("id, title, task_type, required, due_days, due_direction, position")
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
    supabase.from("forms").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase
      .from("onboarding_tasks")
      .select(
        "id, title, task_type, status, doc_path, note, required, due_days, due_direction, applicant_id, application_id, applicants(first_name, last_name, email), applications(start_date)"
      )
      .eq("company_id", current.company_id)
      .order("position", { ascending: true }),
  ]);

  // Group tasks by person.
  type Person = {
    name: string;
    applicationId: string;
    startDate: string | null;
    tasks: OnbTask[];
  };
  const byPerson = new Map<string, Person>();
  for (const t of (tasks ?? []) as unknown as TaskRow[]) {
    const name =
      [t.applicants?.first_name, t.applicants?.last_name].filter(Boolean).join(" ") ||
      t.applicants?.email ||
      "New starter";
    const startDate = t.applications?.start_date ?? null;
    const entry =
      byPerson.get(t.applicant_id) ??
      ({ name, applicationId: t.application_id, startDate, tasks: [] } as Person);
    entry.tasks.push({
      id: t.id,
      title: t.title,
      task_type: t.task_type,
      status: t.status,
      required: t.required,
      doc_path: t.doc_path,
      note: t.note,
      due_date: computeDue(startDate, t.due_days, t.due_direction),
    });
    byPerson.set(t.applicant_id, entry);
  }
  const people = [...byPerson.values()];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Onboarding</h1>
      <p className="mt-1 text-sm text-gray-500">
        When an applicant is hired, your checklist becomes their onboarding tasks.
      </p>

      {isAdmin && (
        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-base font-medium text-gray-900">Onboarding checklist</h2>
          <p className="mt-1 text-sm text-gray-500">
            These tasks are created for every new starter when they&apos;re hired.
          </p>

          {(templates ?? []).length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100">
              {(templates ?? []).map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <span className="text-sm font-medium text-gray-900">{t.title}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {TYPE_LABEL[t.task_type] ?? t.task_type}
                      {t.due_days != null &&
                        ` · due ${t.due_days}d ${t.due_direction === "before" ? "before" : "after"} start`}
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
            <p className="mb-3 text-sm font-medium text-gray-900">Add a checklist task</p>
            <AddTemplateTask forms={forms ?? []} />
          </div>
        </section>
      )}

      {people.length > 0 && (
        <section className="mt-6">
          <h2 className="text-base font-medium text-gray-900">People in onboarding</h2>
          <div className="mt-4 space-y-4">
            {people.map((p, i) => {
              const done = p.tasks.filter((t) => t.status === "approved").length;
              return (
                <div key={i} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">{p.name}</h3>
                    <span className="text-xs text-gray-500">
                      {done}/{p.tasks.length} complete
                    </span>
                  </div>
                  <form action={setStartDate} className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="applicationId" value={p.applicationId} />
                    <label className="text-xs text-gray-600">Start date</label>
                    <input
                      type="date"
                      name="startDate"
                      defaultValue={p.startDate ?? ""}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    />
                    <button className="rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100">
                      Save
                    </button>
                  </form>
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
