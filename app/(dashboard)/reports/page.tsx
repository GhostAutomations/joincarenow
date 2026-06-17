import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import {
  OnboardingTaskReview,
  type OnbTask,
} from "@/components/dashboard/onboarding-task-review";

type TaskRow = OnbTask & {
  applicant_id: string;
  applicants: { first_name: string | null; last_name: string | null; email: string | null } | null;
};

export default async function ReportsPage() {
  const { supabase, current } = await requireCompany();

  const { data: tasks } = await supabase
    .from("onboarding_tasks")
    .select(
      "id, title, task_type, status, doc_path, note, required, due_date, applicant_id, applicants(first_name, last_name, email)"
    )
    .eq("company_id", current.company_id)
    .order("position", { ascending: true });

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
  const totalTasks = people.reduce((n, p) => n + p.tasks.length, 0);

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Onboarding progress across your applicants. More reports (time-to-hire, conversion) coming soon."
      />

      <div className="mt-6 space-y-3">
        <CollapsibleSection title="Applicants with tasks" count={people.length}>
          {people.length === 0 ? (
            <p className="px-1 py-2 text-sm text-gray-500">No applicants have workflow tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {people.map((p, i) => {
                const done = p.tasks.filter((t) => t.status === "approved").length;
                return (
                  <CollapsibleSection
                    key={i}
                    title={`${p.name} — ${done}/${p.tasks.length} complete`}
                    count={p.tasks.length}
                  >
                    <ul className="space-y-2">
                      {p.tasks.map((t) => (
                        <OnboardingTaskReview key={t.id} task={t} />
                      ))}
                    </ul>
                  </CollapsibleSection>
                );
              })}
            </div>
          )}
        </CollapsibleSection>

        <p className="px-1 text-xs text-white/70">
          {people.length} applicant{people.length === 1 ? "" : "s"} · {totalTasks} task
          {totalTasks === 1 ? "" : "s"} tracked
        </p>
      </div>
    </div>
  );
}
