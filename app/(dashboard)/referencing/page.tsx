import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ReferencingBoard,
  type ApplicantGroup,
  type RefRow,
} from "@/components/dashboard/referencing-board";

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

  const { data } = await supabase
    .from("reference_requests")
    .select(
      "id, referee_name, referee_email, referee_employer, relationship, status, application_id, created_at, applicants(first_name, last_name, email), applications(jobs(title))"
    )
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  // Group referees by application.
  const map = new Map<string, ApplicantGroup>();
  for (const r of (data ?? []) as unknown as Row[]) {
    const name =
      [r.applicants?.first_name, r.applicants?.last_name].filter(Boolean).join(" ") ||
      r.applicants?.email ||
      "Applicant";
    const job = r.applications?.jobs?.title ?? "—";
    let g = map.get(r.application_id);
    if (!g) {
      g = { application_id: r.application_id, applicant_name: name, job_title: job, refs: [] };
      map.set(r.application_id, g);
    }
    const ref: RefRow = {
      id: r.id,
      referee_name: r.referee_name,
      referee_email: r.referee_email,
      referee_employer: r.referee_employer,
      relationship: r.relationship,
      status: r.status,
    };
    g.refs.push(ref);
  }
  const groups = [...map.values()];

  return (
    <div>
      <PageHeader
        title="Referencing"
        subtitle="Request, track and approve employment references. Referees complete them online via a secure link — no login needed."
      />
      <ReferencingBoard groups={groups} />
    </div>
  );
}
