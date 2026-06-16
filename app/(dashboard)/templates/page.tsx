import { requireCompany } from "@/modules/auth/queries";
import { TemplatesManager, type Template } from "@/components/dashboard/templates-manager";
import { PageHeader } from "@/components/dashboard/page-header";

export default async function TemplatesPage() {
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("message_templates")
    .select("id, channel, name, subject, body, category")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="Templates"
        subtitle="Reusable email & SMS messages with merge fields. Pick them when messaging an applicant from their record."
      />

      <div className="mt-6">
        <TemplatesManager templates={(data ?? []) as Template[]} />
      </div>
    </div>
  );
}
