import { requireCompany } from "@/modules/auth/queries";
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
  jobs: {
    title: string;
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
  searchParams: Promise<{ open?: string }>;
}) {
  const { open } = await searchParams;
  const { supabase, current } = await requireCompany();

  const [{ data }, { data: ivData }, { data: companyRow }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, stage, created_at, cover_message, cv_path, answers, jobs(title, region, worker_category, branches(name), roles!role_id(name)), applicants(first_name, last_name, email, phone, postcode)"
      )
      .eq("company_id", current.company_id)
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
  const bookedInterviews = (ivData ?? []).map((iv) => ({
    scheduled_at: iv.scheduled_at as string,
    duration_minutes: iv.duration_minutes as number,
    interviewer_id: (iv.interviewer_id as string) ?? null,
  }));

  // Forms the recruiter can send ad-hoc from the pipeline panel. Reference forms
  // are excluded — references go out to referees via the Referencing app.
  const { data: companyForms } = await supabase
    .from("forms")
    .select("id, name, category, purpose")
    .eq("company_id", current.company_id)
    .order("name", { ascending: true });
  const availableForms = ((companyForms ?? []) as {
    id: string;
    name: string;
    category: string | null;
    purpose: string | null;
  }[])
    .filter((f) => f.category !== "referencing" && f.purpose !== "reference")
    .map((f) => ({ id: f.id, name: f.name }));

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
  }));

  return (
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
  );
}
