import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { InterviewRespond, type TokenInterview } from "@/components/interview/interview-respond";

export default async function InterviewTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_interview_by_token", { p_token: token });
  const row = (data as Record<string, unknown>[] | null)?.[0];
  if (!row) notFound();

  const interview: TokenInterview = {
    token,
    scheduled_at: row.scheduled_at as string,
    duration_minutes: row.duration_minutes as number,
    mode: (row.mode as string) ?? null,
    location: (row.location as string) ?? null,
    status: row.status as string,
    company_name: (row.company_name as string) ?? "The team",
    job_title: (row.job_title as string) ?? null,
    first_name: (row.first_name as string) ?? null,
    opening_hours: (row.opening_hours as Record<string, { open: string; close: string } | null>) ?? {},
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <InterviewRespond interview={interview} />
    </div>
  );
}
