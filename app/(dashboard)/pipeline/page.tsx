import Link from "next/link";
import { ChevronRight, ArrowLeft, Briefcase } from "lucide-react";
import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  PipelineBoard,
  type AppCard,
  type Interview,
} from "@/components/dashboard/pipeline-board";

type Row = {
  id: string;
  stage: string;
  created_at: string;
  cover_message: string | null;
  cv_path: string | null;
  answers: { right_to_work?: boolean } | null;
  rtw_doc_path: string | null;
  rtw_share_code: string | null;
  rtw_expiry: string | null;
  rtw_verified_at: string | null;
  jobs: {
    title: string;
    salary: string | null;
    region: string | null;
    worker_category: string | null;
    branches: { name: string } | null;
    roles: { name: string } | null;
  } | null;
  applicants: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    postcode: string | null;
  } | null;
};

type InterviewRow = Interview & { application_id: string };

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string; job?: string }>;
}) {
  const { open, job } = await searchParams;
  const { supabase, current } = await requireCompany();

  // No job selected → show the per-job pipeline list (each job opens its own board).
  if (!job) {
    const [{ data: jobsRaw }, { data: appRows }] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, title, status, branches(name)")
        .eq("company_id", current.company_id)
        .in("status", ["published", "closed"])
        .order("created_at", { ascending: true }),
      supabase.from("applications").select("job_id, stage").eq("company_id", current.company_id),
    ]);

    const counts = new Map<string, { active: number; hired: number; total: number }>();
    for (const a of (appRows ?? []) as { job_id: string | null; stage: string }[]) {
      if (!a.job_id) continue;
      const c = counts.get(a.job_id) ?? { active: 0, hired: 0, total: 0 };
      c.total += 1;
      if (a.stage === "hired") c.hired += 1;
      else if (a.stage !== "rejected") c.active += 1;
      counts.set(a.job_id, c);
    }

    const jobs = (jobsRaw ?? []).map((j) => ({
      id: j.id as string,
      title: j.title as string,
      branch: (j.branches as unknown as { name: string } | null)?.name ?? null,
      status: j.status as string,
      ...(counts.get(j.id as string) ?? { active: 0, hired: 0, total: 0 }),
    }));

    return (
      <div>
        <PageHeader title="Pipeline" subtitle="Choose a job to view its applicants" />
        {jobs.length === 0 ? (
          <p className="mt-6 text-sm text-white/80">
            No live jobs yet. Publish a job to start receiving applicants.
          </p>
        ) : (
          <div className="mx-auto mt-6 max-w-sm space-y-2">
            {jobs.map((j) => (
              <Link
                key={j.id}
                href={`/pipeline?job=${j.id}`}
                className="group flex items-center gap-3 rounded-xl border border-white/40 bg-white/80 px-3 py-2.5 shadow-sm backdrop-blur-sm transition hover:bg-white hover:shadow-md"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Briefcase className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold text-gray-900">{j.title}</span>
                  <span className="block text-sm text-gray-700">
                    {j.branch ? `${j.branch} · ` : ""}
                    {j.active} in Pipeline{j.hired ? ` · ${j.hired} hired` : ""}
                    {j.status === "closed" ? " · closed" : ""}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-gray-300 group-hover:text-gray-500" />
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Job selected → that job's board.
  const { data: jobRow } = await supabase
    .from("jobs")
    .select("title")
    .eq("id", job)
    .eq("company_id", current.company_id)
    .maybeSingle();
  const jobTitle = (jobRow?.title as string) ?? "Pipeline";

  const [{ data }, { data: ivData }, { data: companyRow }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, stage, created_at, cover_message, cv_path, answers, rtw_doc_path, rtw_share_code, rtw_expiry, rtw_verified_at, jobs(title, salary, region, worker_category, branches(name), roles!role_id(name)), applicants(first_name, last_name, email, phone, postcode)"
      )
      .eq("company_id", current.company_id)
      .eq("job_id", job)
      .order("created_at", { ascending: false }),
    supabase
      .from("interviews")
      .select(
        "id, application_id, scheduled_at, duration_minutes, mode, location, channel, status, requested_time, applicant_note, interviewer_id"
      )
      .eq("company_id", current.company_id),
    supabase
      .from("companies")
      .select("settings")
      .eq("id", current.company_id)
      .single(),
  ]);

  const cs = (companyRow?.settings as {
    interview_address?: string;
    opening_hours?: Record<string, { open: string; close: string } | null>;
  } | null) ?? {};
  const interviewAddress = cs.interview_address ?? "";
  const openingHours = cs.opening_hours ?? {};

  const interviewByApp = new Map<string, Interview>();
  for (const iv of (ivData ?? []) as unknown as InterviewRow[]) {
    const { application_id, ...rest } = iv;
    interviewByApp.set(application_id, rest);
  }

  // Booked interviews (for slot conflict detection) + staff list (interviewers).
  // Only live interviews (proposed/confirmed) block a slot — cancelled/declined or
  // reschedule-requested times are free again.
  const bookedInterviews = (ivData ?? [])
    .filter((iv) => iv.status === "proposed" || iv.status === "confirmed")
    .map((iv) => ({
      scheduled_at: iv.scheduled_at as string,
      duration_minutes: iv.duration_minutes as number,
      interviewer_id: (iv.interviewer_id as string) ?? null,
    }));

  // Make sure the system "Your References" form exists so it can be sent.
  await supabase.rpc("ensure_reference_form", { p_company_id: current.company_id });

  // Forms the recruiter can send ad-hoc from the pipeline panel.
  const { data: companyForms } = await supabase
    .from("forms")
    .select("id, name, category, purpose")
    .eq("company_id", current.company_id)
    .order("name", { ascending: true });
  // Show the system "Your References" form (purpose = 'reference'); hide any
  // other referencing-category forms (those belong to the Referencing app).
  const availableForms = ((companyForms ?? []) as {
    id: string;
    name: string;
    category: string | null;
    purpose: string | null;
  }[])
    .filter((f) => f.purpose === "reference" || f.category !== "referencing")
    .map((f) => ({ id: f.id, name: f.name }));

  // Reference status per application (for the card chip).
  const { data: refRows } = await supabase
    .from("reference_requests")
    .select("application_id, status")
    .eq("company_id", current.company_id);
  // Most-urgent state wins for the chip: info needed > to request > awaiting > review > approved.
  const REF_PRIORITY = ["rejected", "pending", "sent", "received", "approved"];
  const refsByApp = new Map<string, { state: string; total: number }>();
  for (const r of (refRows ?? []) as { application_id: string; status: string }[]) {
    const cur = refsByApp.get(r.application_id) ?? { state: "approved", total: 0 };
    cur.total += 1;
    if (REF_PRIORITY.indexOf(r.status) < REF_PRIORITY.indexOf(cur.state)) cur.state = r.status;
    refsByApp.set(r.application_id, cur);
  }

  // Latest offer status per application (for the card status line).
  const { data: offerRows } = await supabase
    .from("offers")
    .select("application_id, status, created_at")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });
  const offerByApp = new Map<string, string>();
  for (const o of (offerRows ?? []) as { application_id: string; status: string }[]) {
    if (!offerByApp.has(o.application_id)) offerByApp.set(o.application_id, o.status);
  }

  const { data: staffRaw } = await supabase
    .from("company_users")
    .select("user_id, profiles ( full_name, email )")
    .eq("company_id", current.company_id);
  const staff = (staffRaw ?? []).map((m) => {
    const p = m.profiles as unknown as { full_name: string | null; email: string } | null;
    return { user_id: m.user_id as string, name: p?.full_name || p?.email || "Team member" };
  });

  // Custom application-form answers per application (resolve field ids → labels).
  const { data: subs } = await supabase
    .from("form_submissions")
    .select("application_id, form_id, answers")
    .eq("company_id", current.company_id);

  const formIds = [...new Set((subs ?? []).map((s) => s.form_id))];
  const { data: fieldRows } = formIds.length
    ? await supabase
        .from("form_fields")
        .select("id, form_id, label, field_type, position")
        .in("form_id", formIds)
        .order("position", { ascending: true })
    : { data: [] };

  type FieldRow = {
    id: string;
    form_id: string;
    label: string;
    field_type: string;
    position: number;
  };
  const fieldsByForm = new Map<string, FieldRow[]>();
  for (const f of (fieldRows ?? []) as FieldRow[]) {
    const list = fieldsByForm.get(f.form_id) ?? [];
    list.push(f);
    fieldsByForm.set(f.form_id, list);
  }

  const formatAnswer = (v: unknown, type: string): string => {
    if (v == null || v === "") return "";
    if (type === "signature") return "Signature captured";
    if (type === "file") {
      const path = Array.isArray(v) ? v.join(", ") : String(v);
      return path.split("/").pop() || "File attached";
    }
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  // Per-application form status counts for the card indicator.
  const { data: formStatus } = await supabase.rpc("get_application_form_status");
  type FormStatus = { application_id: string; awaiting: number; resent: number; total: number };
  const formStatusByApp = new Map<string, FormStatus>();
  for (const fsr of (formStatus ?? []) as FormStatus[]) {
    formStatusByApp.set(fsr.application_id, fsr);
  }

  const answersByApp = new Map<string, { label: string; value: string }[]>();
  const transportByApp = new Map<string, string>();
  for (const s of subs ?? []) {
    if (!s.application_id) continue;
    const fields = fieldsByForm.get(s.form_id) ?? [];
    const answers = (s.answers ?? {}) as Record<string, unknown>;
    const out: { label: string; value: string }[] = [];
    for (const f of fields) {
      const value = formatAnswer(answers[f.id], f.field_type);
      if (value) out.push({ label: f.label, value });
      // Capture the applicant's transport (Driver / Walker) for the card.
      if (f.field_type === "transport" && value) transportByApp.set(s.application_id, value);
    }
    answersByApp.set(s.application_id, out);
  }

  const apps: AppCard[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    stage: r.stage,
    created_at: r.created_at,
    cover_message: r.cover_message,
    cv_path: r.cv_path,
    answers: r.answers,
    job_title: r.jobs?.title ?? "—",
    branch: r.jobs?.branches?.name ?? r.jobs?.region ?? null,
    worker_category: r.jobs?.roles?.name ?? r.jobs?.worker_category ?? null,
    first_name: r.applicants?.first_name ?? null,
    last_name: r.applicants?.last_name ?? null,
    email: r.applicants?.email ?? null,
    phone: r.applicants?.phone ?? null,
    postcode: r.applicants?.postcode ?? null,
    interview: interviewByApp.get(r.id) ?? null,
    customAnswers: answersByApp.get(r.id) ?? [],
    formAwaiting: formStatusByApp.get(r.id)?.awaiting ?? 0,
    formResent: formStatusByApp.get(r.id)?.resent ?? 0,
    formTotal: formStatusByApp.get(r.id)?.total ?? 0,
    transport: transportByApp.get(r.id) ?? null,
    rtwVerifiedAt: r.rtw_verified_at,
    rtwShareCode: r.rtw_share_code,
    rtwExpiry: r.rtw_expiry,
    rtwHasDoc: !!r.rtw_doc_path,
    refsState: refsByApp.get(r.id)?.state ?? null,
    refsTotal: refsByApp.get(r.id)?.total ?? 0,
    offerStatus: offerByApp.get(r.id) ?? null,
    salary: r.jobs?.salary ?? null,
  }));

  return (
    <div>
      <Link
        href="/pipeline"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> All pipelines
      </Link>
      <h1 className="mt-2 mb-4 text-2xl font-semibold text-white drop-shadow-sm">{jobTitle}</h1>
      <PipelineBoard
        initial={apps}
        interviewAddress={interviewAddress}
        openId={open ?? null}
        companyId={current.company_id}
        openingHours={openingHours}
        staff={staff}
        bookedInterviews={bookedInterviews}
        availableForms={availableForms}
      />
    </div>
  );
}
