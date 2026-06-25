import { requireCompany } from "@/modules/auth/queries";
import { feedbackOpen } from "@/lib/feedback";
import { PageHeader } from "@/components/dashboard/page-header";
import { FeedbackForm } from "@/components/dashboard/feedback-form";

type Row = {
  id: string;
  body: string;
  response: string | null;
  created_at: string;
  responded_at: string | null;
};

export default async function FeedbackPage() {
  const { supabase, current } = await requireCompany();

  const [{ data: company }, { data: rows }] = await Promise.all([
    supabase.from("companies").select("created_at").eq("id", current.company_id).single(),
    supabase
      .from("feedback")
      .select("id, body, response, created_at, responded_at")
      .eq("company_id", current.company_id)
      .order("created_at", { ascending: false }),
  ]);

  const open = feedbackOpen(company?.created_at as string | undefined);
  const items = (rows ?? []) as Row[];

  return (
    <div>
      <PageHeader title="Feedback" subtitle="Help shape Join Care Now." />

      {open ? (
        <div className="mt-6">
          <FeedbackForm />
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-white/40 bg-white/70 backdrop-blur-md p-4 text-sm text-gray-600 shadow-sm">
          Your feedback window has closed, but you can still see your past feedback and our replies below.
        </div>
      )}

      <h2 className="mt-8 text-sm font-medium text-white/80">Your feedback</h2>
      <div className="mt-3 space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No feedback yet.
          </div>
        )}
        {items.map((f) => (
          <div key={f.id} className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-5 shadow-sm">
            <p className="whitespace-pre-wrap text-sm text-gray-800">{f.body}</p>
            <p className="mt-1 text-xs text-gray-400">{new Date(f.created_at).toLocaleString("en-GB")}</p>
            {f.response && (
              <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50 p-3">
                <p className="text-xs font-semibold text-brand-800">Join Care Now replied</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-brand-900">{f.response}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
