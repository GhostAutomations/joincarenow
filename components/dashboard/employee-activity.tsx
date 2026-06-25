import { FileDown, UserMinus, UserCheck, Briefcase, History } from "lucide-react";

export type ActivityEvent = {
  id: string;
  action: string;
  after: Record<string, unknown> | null;
  createdAt: string;
  actorName: string | null;
};

const EMP_TYPE_LABEL: Record<string, string> = {
  full_time: "Full time",
  part_time: "Part time",
  student_20: "Student (20h)",
};

function describe(e: ActivityEvent): { icon: typeof History; label: string; detail?: string } {
  const a = e.after ?? {};
  switch (e.action) {
    case "employee.staff_file_downloaded":
      return { icon: FileDown, label: "Staff file downloaded" };
    case "employee.marked_leaver":
      return {
        icon: UserMinus,
        label: "Marked as leaver",
        detail: [a.reason ? String(a.reason) : null, a.last_working_day ? `last day ${new Date(String(a.last_working_day)).toLocaleDateString("en-GB")}` : null]
          .filter(Boolean)
          .join(" · ") || undefined,
      };
    case "employee.reinstated":
      return { icon: UserCheck, label: "Reinstated to active" };
    case "employee.employment_type_changed":
      return { icon: Briefcase, label: "Employment type changed", detail: a.employment_type ? EMP_TYPE_LABEL[String(a.employment_type)] ?? String(a.employment_type) : undefined };
    default:
      return { icon: History, label: e.action.replace(/^employee\./, "").replace(/_/g, " ") };
  }
}

/** Admin-only activity/audit trail for an employee (staff-file downloads, leaver
 *  and reinstate events, employment-type changes). Reads from audit_logs. */
export function EmployeeActivity({ events }: { events: ActivityEvent[] }) {
  return (
    <section className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-medium text-gray-900">
        <History className="h-4 w-4 text-gray-400" aria-hidden /> Activity
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No recorded activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100">
          {events.map((e) => {
            const d = describe(e);
            const Icon = d.icon;
            return (
              <li key={e.id} className="flex items-start gap-3 py-2.5">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {d.label}
                    {d.detail && <span className="font-normal text-gray-500"> — {d.detail}</span>}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(e.createdAt).toLocaleString("en-GB")}
                    {e.actorName && ` · ${e.actorName}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
