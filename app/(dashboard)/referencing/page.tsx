import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { ReferencingBoard, type RefCard } from "@/components/dashboard/referencing-board";

type Row = {
  id: string;
  referee_name: string;
  referee_email: string;
  referee_employer: string | null;
  relationship: string | null;
  status: string;
  application_id: string;
  created_at: string;
  applicants: { first_name: string | null; last_name: string | null; email: string | null } | null;
  applications: { jobs: { title: string } | null } | null;
};

export default async function ReferencingPage() {
  const { supabase, current } = await requireCompany();

  // Make sure the "Your References" form exists so it shows in the Form Builder
  // and can be selected in workflows.
  await supabase.rpc("ensure_reference_form", { p_company_id: current.company_id });

  const { data } = await supabase
    .from("reference_requests")
    .select(
      "id, referee_name, referee_email, referee_employer, relationship, status, application_id, created_at, applicants(first_name, last_name, email), applications(jobs(title))"
    )
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  const cards: RefCard[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    applicant_name:
      [r.applicants?.first_name, r.applicants?.last_name].filter(Boolean).join(" ") ||
      r.applicants?.email ||
      "Applicant",
    job_title: r.applications?.jobs?.title ?? "—",
    referee_name: r.referee_name,
    referee_email: r.referee_email,
    referee_employer: r.referee_employer,
    relationship: r.relationship,
    status: r.status,
  }));

  return (
    <div>
      <PageHeader
        title="Referencing"
        subtitle="Request, track and approve employment references. Referees complete them online via a secure link — no login needed."
      />
      <ReferencingBoard cards={cards} companyId={current.company_id} />
    </div>
  );
}
