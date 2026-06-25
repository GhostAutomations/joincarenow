import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { FeedbackRespond } from "@/components/dashboard/feedback-respond";

type Row = {
  id: string;
  body: string;
  response: string | null;
  created_at: string;
  companies: { name: string | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminFeedbackPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data } = await db
    .from("feedback")
    .select("id, body, response, created_at, companies(name), profiles:author_id(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(300);
  const items = (data ?? []) as unknown as Row[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Feedback</h1>
      <p className="mt-1 text-sm text-white/80">Feedback from companies during their first 4 weeks. Reply and they&apos;ll see it.</p>

      <div className="mt-4 space-y-3">
        {items.length === 0 && (
          <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
            No feedback yet.
          </div>
        )}
        {items.map((f) => (
          <div key={f.id} className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-medium text-gray-700">{f.companies?.name ?? "—"}</span>
              <span>· {f.profiles?.full_name || f.profiles?.email || "Unknown"}</span>
              <span className="ml-auto">{new Date(f.created_at).toLocaleString("en-GB")}</span>
              {f.response && <span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800">Replied</span>}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{f.body}</p>
            <FeedbackRespond id={f.id} existing={f.response} />
          </div>
        ))}
      </div>
    </div>
  );
}
