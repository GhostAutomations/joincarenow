import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApprovalCard, type Draft } from "@/components/dashboard/approval-card";

export default async function ApprovalsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("prospect_activities")
    .select("id, prospect_company_id, channel, subject, body, high_risk, created_at, prospect_companies(name), prospect_contacts(name, email, phone)")
    .eq("needs_approval", true)
    .order("created_at", { ascending: true })
    .limit(200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const drafts: Draft[] = (data ?? []).map((d: any) => ({
    id: d.id,
    companyId: d.prospect_company_id,
    companyName: d.prospect_companies?.name ?? "—",
    contactLabel: d.prospect_contacts?.name || d.prospect_contacts?.email || d.prospect_contacts?.phone || "—",
    channel: d.channel ?? "email",
    subject: d.subject,
    body: d.body ?? "",
    highRisk: !!d.high_risk,
    createdAt: d.created_at,
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/founder/sales" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Needs approval</h1>
      <p className="mt-1 text-sm text-white/80">
        Drafts from sequences and agents waiting for your review. Edit if needed, then approve to send.
      </p>

      <div className="mt-6 space-y-3">
        {drafts.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            Nothing waiting for approval.
          </div>
        )}
        {drafts.map((d) => <ApprovalCard key={d.id} draft={d} />)}
      </div>
    </div>
  );
}
