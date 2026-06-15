import { requireCompany } from "@/modules/auth/queries";
import { TemplatesManager, type Template } from "@/components/dashboard/templates-manager";

export default async function TemplatesPage() {
  const { supabase, current } = await requireCompany();

  const { data } = await supabase
    .from("message_templates")
    .select("id, channel, name, subject, body, category")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Templates</h1>
      <p className="mt-1 text-sm text-gray-500">
        Reusable email &amp; SMS messages with merge fields. Pick them when
        messaging an applicant from their record.
      </p>

      <div className="mt-6">
        <TemplatesManager templates={(data ?? []) as Template[]} />
      </div>
    </div>
  );
}
