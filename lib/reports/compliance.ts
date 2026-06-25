import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPLOYMENT_TYPE_LABEL } from "@/lib/hr";
import { RANGES, rangeKeyOf } from "@/lib/reports/data";

export { RANGES, rangeKeyOf };

type Emp = {
  id: string; employee_ref: string | null; first_name: string | null; last_name: string | null;
  job_title: string | null; branch: string | null; employment_type: string | null;
  start_date: string | null; status: string; application_id: string | null;
  created_at: string; left_at: string | null; leaving_reason: string | null; leaving_reason_detail: string | null;
};

const name = (e: Emp) => [e.first_name, e.last_name].filter(Boolean).join(" ") || e.employee_ref || "Employee";
const etLabel = (v: string | null) => (v ? EMPLOYMENT_TYPE_LABEL[v] ?? v : "Not set");

async function loadEmployees(db: SupabaseClient, companyId: string): Promise<Emp[]> {
  const { data } = await db
    .from("employees")
    .select("id, employee_ref, first_name, last_name, job_title, branch, employment_type, start_date, status, application_id, created_at, left_at, leaving_reason, leaving_reason_detail")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return (data ?? []) as Emp[];
}

// 1. Staff register — current (active) staff roster.
export type StaffRow = { ref: string; name: string; role: string; branch: string; type: string; start: string };
export async function getStaffRegister(db: SupabaseClient, companyId: string): Promise<StaffRow[]> {
  const emps = (await loadEmployees(db, companyId)).filter((e) => e.status === "active");
  return emps.map((e) => ({
    ref: e.employee_ref ?? "—",
    name: name(e),
    role: e.job_title ?? "—",
    branch: e.branch ?? "—",
    type: etLabel(e.employment_type),
    start: e.start_date ? new Date(e.start_date).toLocaleDateString("en-GB") : "—",
  }));
}

// 2. Safe recruitment compliance — RTW, references and DBS per current staff member.
export type SafeRow = { name: string; role: string; rtw: string; refs: string; dbs: string; gaps: number };
export async function getSafeRecruitment(db: SupabaseClient, companyId: string): Promise<SafeRow[]> {
  const emps = (await loadEmployees(db, companyId)).filter((e) => e.status === "active");
  const appIds = emps.map((e) => e.application_id).filter(Boolean) as string[];
  const empIds = emps.map((e) => e.id);

  const [{ data: apps }, { data: refs }, { data: docs }] = await Promise.all([
    appIds.length ? db.from("applications").select("id, rtw_verified_at, rtw_expiry").in("id", appIds) : Promise.resolve({ data: [] }),
    appIds.length ? db.from("reference_requests").select("application_id, status").in("application_id", appIds) : Promise.resolve({ data: [] }),
    empIds.length ? db.from("employee_documents").select("employee_id, doc_type").in("employee_id", empIds) : Promise.resolve({ data: [] }),
  ]);
  const appMap = new Map((apps ?? []).map((a) => [a.id as string, a]));
  const refMap = new Map<string, { total: number; approved: number }>();
  for (const r of refs ?? []) {
    const m = refMap.get(r.application_id as string) ?? { total: 0, approved: 0 };
    m.total += 1; if (r.status === "approved") m.approved += 1; refMap.set(r.application_id as string, m);
  }
  const dbsSet = new Set<string>();
  for (const d of docs ?? []) if (/dbs/i.test((d.doc_type as string) ?? "")) dbsSet.add(d.employee_id as string);

  return emps.map((e) => {
    const app = e.application_id ? appMap.get(e.application_id) : null;
    const rtwOk = !!app?.rtw_verified_at;
    const ref = e.application_id ? refMap.get(e.application_id) : undefined;
    const refsOk = !!ref && ref.approved >= 1;
    const dbsOk = dbsSet.has(e.id);
    let gaps = 0; if (!rtwOk) gaps++; if (!refsOk) gaps++; if (!dbsOk) gaps++;
    return {
      name: name(e),
      role: e.job_title ?? "—",
      rtw: rtwOk ? (app?.rtw_expiry ? `Verified (exp ${new Date(app.rtw_expiry as string).toLocaleDateString("en-GB")})` : "Verified") : "Not verified",
      refs: ref ? `${ref.approved}/${ref.total} approved` : "None",
      dbs: dbsOk ? "On file" : "Not on file",
      gaps,
    };
  });
}

// 3. Turnover & leavers.
export type TurnoverReport = {
  rangeKey: string; rangeLabel: string;
  metrics: { headcount: number; joiners: number; leavers: number; turnoverPct: number };
  leaverRows: { name: string; role: string; branch: string; left: string; reason: string }[];
};
export async function getTurnover(db: SupabaseClient, companyId: string, rangeKey: string): Promise<TurnoverReport> {
  const days = RANGES[rangeKey].days;
  const cut = days ? Date.now() - days * 86400e3 : null;
  const inRange = (iso: string | null) => !!iso && (cut === null || new Date(iso).getTime() >= cut);

  const emps = await loadEmployees(db, companyId);
  const active = emps.filter((e) => e.status === "active");
  const joiners = emps.filter((e) => inRange(e.start_date ?? e.created_at));
  const leavers = emps.filter((e) => e.status === "left" && inRange(e.left_at));
  const headcount = active.length;
  const turnoverPct = headcount + leavers.length > 0 ? Math.round((leavers.length / (headcount + leavers.length)) * 100) : 0;

  return {
    rangeKey, rangeLabel: RANGES[rangeKey].label,
    metrics: { headcount, joiners: joiners.length, leavers: leavers.length, turnoverPct },
    leaverRows: leavers
      .sort((a, b) => (b.left_at ?? "").localeCompare(a.left_at ?? ""))
      .map((e) => ({
        name: name(e),
        role: e.job_title ?? "—",
        branch: e.branch ?? "—",
        left: e.left_at ? new Date(e.left_at).toLocaleDateString("en-GB") : "—",
        reason: e.leaving_reason === "Other" ? (e.leaving_reason_detail || "Other") : (e.leaving_reason ?? "—"),
      })),
  };
}

// 4. Staffing establishment — headcount by branch x employment type + vacancies.
export type EstablishmentReport = {
  branchRows: { branch: string; full_time: number; part_time: number; student_20: number; not_set: number; total: number }[];
  totals: { full_time: number; part_time: number; student_20: number; not_set: number; total: number };
  vacancies: number;
};
export async function getEstablishment(db: SupabaseClient, companyId: string): Promise<EstablishmentReport> {
  const emps = (await loadEmployees(db, companyId)).filter((e) => e.status === "active");
  const { data: jobs } = await db.from("jobs").select("vacancies, status").eq("company_id", companyId).eq("status", "published");
  const vacancies = (jobs ?? []).reduce((s, j) => s + ((j.vacancies as number) ?? 0), 0);

  type Row = { branch: string; full_time: number; part_time: number; student_20: number; not_set: number; total: number };
  const map = new Map<string, Row>();
  const bump = (branch: string, key: keyof Omit<Row, "branch">) => {
    const r = map.get(branch) ?? { branch, full_time: 0, part_time: 0, student_20: 0, not_set: 0, total: 0 };
    r[key] += 1; r.total += 1; map.set(branch, r);
  };
  const totals = { full_time: 0, part_time: 0, student_20: 0, not_set: 0, total: 0 };
  for (const e of emps) {
    const branch = e.branch?.trim() || "Unassigned";
    const key = (e.employment_type === "full_time" ? "full_time" : e.employment_type === "part_time" ? "part_time" : e.employment_type === "student_20" ? "student_20" : "not_set") as keyof Omit<Row, "branch">;
    bump(branch, key);
    totals[key] += 1; totals.total += 1;
  }
  return { branchRows: [...map.values()].sort((a, b) => b.total - a.total), totals, vacancies };
}
