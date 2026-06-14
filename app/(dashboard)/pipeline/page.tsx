import { requireCompany } from "@/modules/auth/queries";
import { PipelineBoard, type AppCard } from "@/components/dashboard/pipeline-board";

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

export default async function PipelinePage() {
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("applications")
    .select(
      "id, stage, created_at, cover_message, cv_path, answers, jobs(title), applicants(first_name, last_name, email, phone, postcode)"
    )
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

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
  }));

  return <PipelineBoard initial={apps} />;
}
