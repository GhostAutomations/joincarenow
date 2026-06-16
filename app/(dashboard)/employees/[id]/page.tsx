import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { EmployeeEditForm } from "@/components/dashboard/employee-edit-form";
import {
  EmployeeHr,
  type Absence,
  type Warning,
  type HrDoc,
} from "@/components/dashboard/employee-hr";

type Employee = {
  id: string;
  company_id: string;
  applicant_id: string | null;
  application_id: string | null;
  employee_ref: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  department: string | null;
  branch_id: string | null;
  branch: string | null;
  worker_category: string | null;
  manager_id: string | null;
  start_date: string | null;
  training_group: string | null;
  status: "active" | "inactive" | "left";
  created_at: string;
};

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, current } = await requireCompany();

  const { data: employee } = await supabase
    .from("employees")
    .select(
      "id, company_id, applicant_id, application_id, employee_ref, first_name, last_name, email, phone, job_title, department, branch_id, branch, worker_category, manager_id, start_date, training_group, status, created_at"
    )
    .eq("id", id)
    .eq("company_id", current.company_id)
    .maybeSingle<Employee>();

  if (!employee) notFound();

  // HR records for this employee.
  const [{ data: absences }, { data: warnings }, { data: documents }] = await Promise.all([
    supabase
      .from("employee_absences")
      .select("id, absence_type, start_date, end_date, days, reason")
      .eq("employee_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("employee_warnings")
      .select("id, level, title, note, issued_date, review_date")
      .eq("employee_id", id)
      .order("issued_date", { ascending: false }),
    supabase
      .from("employee_documents")
      .select("id, doc_type, title, issued_date, expiry_date")
      .eq("employee_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // Roster for the manager dropdown (admins + managers) + branch + role lists.
  const [{ data: rosterRaw }, { data: branchList }, { data: roleList }] = await Promise.all([
    supabase
      .from("company_users")
      .select("user_id, role, profiles ( full_name, email )")
      .eq("company_id", current.company_id)
      .in("role", ["admin", "manager"]),
    supabase
      .from("branches")
      .select("id, name")
      .eq("company_id", current.company_id)
      .order("name"),
    supabase
      .from("roles")
      .select("id, name")
      .eq("company_id", current.company_id)
      .order("name"),
  ]);

  const managers = (rosterRaw ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string } | null;
    return { user_id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });

  const fullName =
    [employee.first_name, employee.last_name].filter(Boolean).join(" ") ||
    employee.email ||
    "Employee";
  const managerName = managers.find((m) => m.user_id === employee.manager_id)?.name;

  return (
    <div>
      <Link
        href="/employees"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" /> All employees
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{fullName}</h1>
        <span className="rounded-full bg-brand-50 px-2.5 py-0.5 font-mono text-xs text-brand-700">
          {employee.employee_ref}
        </span>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
          {employee.status}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Hired {new Date(employee.created_at).toLocaleDateString("en-GB")}
        {managerName && ` · Reports to ${managerName}`}
      </p>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Master record (read-only summary) */}
        <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Master profile</h2>
          <p className="mt-1 text-xs text-gray-400">
            The source of truth shared with connected systems.
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-gray-500">Email</dt>
              <dd className="font-medium text-gray-900">{employee.email || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Mobile</dt>
              <dd className="font-medium text-gray-900">{employee.phone || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Role</dt>
              <dd className="font-medium text-gray-900">{employee.job_title || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Branch</dt>
              <dd className="font-medium text-gray-900">{employee.branch || "—"}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Start date</dt>
              <dd className="font-medium text-gray-900">
                {employee.start_date
                  ? new Date(employee.start_date).toLocaleDateString("en-GB")
                  : "—"}
              </dd>
            </div>
          </dl>
          {employee.applicant_id && (
            <Link
              href="/pipeline"
              className="mt-5 inline-block text-sm text-brand-600 hover:underline"
            >
              View recruitment history →
            </Link>
          )}
        </section>

        {/* Editable fields */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 shadow-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Employment details</h2>
          <p className="mt-1 text-xs text-gray-400">
            These feed the Carer.Academy sync and future connected systems.
          </p>
          <div className="mt-4">
            <EmployeeEditForm
              employee={{
                id: employee.id,
                employee_ref: employee.employee_ref,
                job_title: employee.job_title,
                department: employee.department,
                branch_id: employee.branch_id,
                worker_category: employee.worker_category,
                training_group: employee.training_group,
                phone: employee.phone,
                start_date: employee.start_date,
                manager_id: employee.manager_id,
                status: employee.status,
              }}
              managers={managers}
              branches={branchList ?? []}
              roles={roleList ?? []}
            />
          </div>
        </section>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-medium text-gray-900">HR record</h2>
        <EmployeeHr
          employeeId={employee.id}
          absences={(absences ?? []) as Absence[]}
          warnings={(warnings ?? []) as Warning[]}
          documents={(documents ?? []) as HrDoc[]}
        />
      </div>
    </div>
  );
}
