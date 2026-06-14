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
  jobs: { title: string } | null;
  applicants: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    postcode: string | null;
  } | null;
};

type InterviewRow = Interview & { application_id: string };

export default async function PipelinePage() {
  const { supabase, current } = await requireCompany();

  const [{ data }, { data: ivData }, { data: companyRow }] = await Promise.all([
    supabase
      .from("applications")
      .select(
        "id, stage, created_at, cover_message, cv_path, answers, jobs(title), applicants(first_name, last_name, email, phone, postcode)"
      )
      .eq("company_id", current.company_id)
      .order("created_at", { ascending: false }),
    supabase
      .from("interviews")
      .select(
        "id, application_id, scheduled_at, duration_minutes, mode, location, channel, status, requested_time, applicant_note"
      )
      .eq("company_id", current.company_id),
    supabase
      .from("companies")
      .select("settings")
      .eq("id", current.company_id)
      .single(),
  ]);

  const interviewAddress =
    ((companyRow?.settings as { interview_address?: string } | null)
      ?.interview_address) ?? "";

  const interviewByApp = new Map<string, Interview>();
  for (const iv of (ivData ?? []) as unknown as InterviewRow[]) {
    const { application_id, ...rest } = iv;
    interviewByApp.set(application_id, rest);
  }

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
    if (type === "file") {
      const path = Array.isArray(v) ? v.join(", ") : String(v);
      return path.split("/").pop() || "File attached";
    }
    return Array.isArray(v) ? v.join(", ") : String(v);
  };

  const answersByApp = new Map<string, { label: string; value: string }[]>();
  for (const s of subs ?? []) {
    if (!s.application_id) continue;
    const fields = fieldsByForm.get(s.form_id) ?? [];
    const answers = (s.answers ?? {}) as Record<string, unknown>;
    const out: { label: string; value: string }[] = [];
    for (const f of fields) {
      const value = formatAnswer(answers[f.id], f.field_type);
      if (value) out.push({ label: f.label, value });
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
    first_name: r.applicants?.first_name ?? null,
    last_name: r.applicants?.last_name ?? null,
    email: r.applicants?.email ?? null,
    phone: r.applicants?.phone ?? null,
    postcode: r.applicants?.postcode ?? null,
    interview: interviewByApp.get(r.id) ?? null,
    customAnswers: answersByApp.get(r.id) ?? [],
  }));

  return <PipelineBoard initial={apps} interviewAddress={interviewAddress} />;
}
