// Carer.Academy integration — Join Care Now pushes a hired employee so a
// training account is created. Outbound only; never throws.
//
// ───────────────────────────────────────────────────────────────────────────
// WEBHOOK CONTRACT (what Carer.Academy must implement)
//   POST  <CARER_ACADEMY_WEBHOOK_URL>
//   Header: x-api-key: <CARER_ACADEMY_API_KEY>
//   Body (application/json):
//     {
//       "employee_id":   "EMP-0001",      // JCN employee_ref (stable key)
//       "first_name":    "Jane",
//       "last_name":     "Doe",
//       "email":         "jane@example.com",
//       "mobile":        "+447...",
//       "job_role":      "Support Worker",
//       "worker_category":"Driver",
//       "department":    "Domiciliary",
//       "branch":        "Cardiff",
//       "location":      "Cardiff",
//       "company":       "Acme Care Ltd",
//       "manager":       "Sam Manager",
//       "start_date":    "2026-07-01",
//       "training_group":"Mandatory"
//     }
//   Expected response (2xx): { "user_id": "<academy user id>" }  // user_id optional
//   Non-2xx or network error → JCN marks the employee sync as "error" and the
//   recruiter can Resend from the employee record.
// ───────────────────────────────────────────────────────────────────────────

import { createClient } from "@/lib/supabase/server";

export type SyncResult = { ok: boolean; academyUserId?: string; error?: string };

type EmployeeRow = {
  id: string;
  company_id: string;
  employee_ref: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  worker_category: string | null;
  branch: string | null;
  department: string | null;
  location: string | null;
  training_group: string | null;
  start_date: string | null;
  manager_id: string | null;
  companies: { name: string } | null;
};

/**
 * Send (or re-send) an employee to Carer.Academy and log the attempt.
 * Safe to call from any company-member server action.
 */
export async function syncEmployeeToCarerAcademy(employeeId: string): Promise<SyncResult> {
  const url = process.env.CARER_ACADEMY_WEBHOOK_URL;
  const key = process.env.CARER_ACADEMY_API_KEY;

  const supabase = await createClient();

  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select(
      "id, company_id, employee_ref, first_name, last_name, email, phone, job_title, worker_category, branch, department, location, training_group, start_date, manager_id, companies(name)"
    )
    .eq("id", employeeId)
    .single<EmployeeRow>();

  if (empErr || !emp) return { ok: false, error: "Employee not found." };

  // Resolve manager name (optional).
  let manager: string | null = null;
  if (emp.manager_id) {
    const { data: mgr } = await supabase
      .from("profiles").select("full_name").eq("id", emp.manager_id).single();
    manager = (mgr?.full_name as string | undefined) ?? null;
  }

  const payload = {
    employee_id: emp.employee_ref,
    first_name: emp.first_name,
    last_name: emp.last_name,
    email: emp.email,
    mobile: emp.phone,
    job_role: emp.job_title,
    worker_category: emp.worker_category,
    department: emp.department ?? emp.branch,
    branch: emp.branch,
    location: emp.location,
    company: emp.companies?.name ?? null,
    manager,
    start_date: emp.start_date,
    training_group: emp.training_group,
  };

  // How many times have we tried before? (for the event log)
  const { count } = await supabase
    .from("integration_events")
    .select("id", { count: "exact", head: true })
    .eq("employee_id", employeeId)
    .eq("target", "carer_academy");
  const attempt = (count ?? 0) + 1;

  const record = (
    status: "success" | "error",
    response: unknown,
    error: string | null,
    academyUserId: string | null
  ) =>
    supabase.rpc("log_carer_academy_sync", {
      p_employee_id: employeeId,
      p_status: status,
      p_attempt: attempt,
      p_request: payload,
      p_response: (response ?? null) as never,
      p_error: error,
      p_academy_user_id: academyUserId,
    });

  if (!url || !key) {
    const error = "Carer.Academy is not configured (missing CARER_ACADEMY_WEBHOOK_URL / CARER_ACADEMY_API_KEY).";
    await record("error", null, error, null);
    return { ok: false, error };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as { user_id?: string; message?: string };

    if (!res.ok) {
      const error = data.message || `Carer.Academy returned ${res.status}`;
      await record("error", data, error, null);
      return { ok: false, error };
    }

    await record("success", data, null, data.user_id ?? null);
    return { ok: true, academyUserId: data.user_id };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Carer.Academy sync failed";
    await record("error", null, error, null);
    return { ok: false, error };
  }
}
