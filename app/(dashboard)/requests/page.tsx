import { requireCompany } from "@/modules/auth/queries";
import { PageHeader } from "@/components/dashboard/page-header";
import { RequestForm } from "@/components/dashboard/request-form";
import { RequestDecide } from "@/components/dashboard/request-decide";

type Row = {
  id: string;
  title: string;
  body: string;
  status: string;
  quote_amount: string | null;
  quote_note: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  quoted: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-gray-200 text-gray-600",
};
const STATUS_LABEL: Record<string, string> = {
  new: "Awaiting quote",
  quoted: "Quoted",
  accepted: "Accepted",
  declined: "Declined",
};

export default async function RequestsPage() {
  const { supabase, current } = await requireCompany();

  if (current.role !== "admin") {
    return (
      <div>
        <PageHeader title="Feature requests" subtitle="Request new features for your company." />
        <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
          Only your company admin can submit and manage feature requests.
        </div>
      </div>
    );
  }

  const { data: rows } = await supabase
    .from("feature_requests")
    .select("id, title, body, status, quote_amount, quote_note, created_at")
    .eq("company_id", current.company_id)
    .order("created_at", { ascending: false });
  const items = (rows ?? []) as Row[];

  return (
    <div>
      <PageHeader title="Feature requests" subtitle="Request new features — we'll quote what it takes to build." />

      <div className="mt-6">
        <RequestForm />
      </div>

      <h2 className="mt-8 text-sm font-medium text-white/80">Your requests</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No requests yet.
          </div>
        )}
        {items.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-gray-900">{r.title}</p>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>
                {STATUS_LABEL[r.status] ?? r.status}
              </span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{r.body}</p>
            <p className="mt-1 text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-GB")}</p>

            {(r.status === "quoted" || r.status === "accepted" || r.status === "declined") && r.quote_amount && (
              <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50 p-3">
                <p className="text-sm font-semibold text-brand-900">Quote: {r.quote_amount}</p>
                {r.quote_note && <p className="mt-1 whitespace-pre-wrap text-sm text-brand-800">{r.quote_note}</p>}
                {r.status === "quoted" && <RequestDecide id={r.id} />}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
