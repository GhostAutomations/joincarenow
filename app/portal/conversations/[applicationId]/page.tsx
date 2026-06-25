import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireApplicant } from "@/modules/auth/queries";
import { cleanMessageBody } from "@/lib/comms/clean";
import { ConversationThread, type ChatMessage } from "@/components/portal/conversation-thread";
import { PortalLive } from "@/components/portal/portal-live";

type MyApp = { application_id: string; job_title: string; company_name: string };

export default async function PortalConversationPage({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase } = await requireApplicant(`/portal/conversations/${applicationId}`);

  const { data: apps } = await supabase.rpc("get_my_applications");
  const app = ((apps ?? []) as MyApp[]).find((a) => a.application_id === applicationId);
  if (!app) notFound();

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, body, direction, created_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  const messages: ChatMessage[] = (msgs ?? []).map((m) => ({
    id: m.id as string,
    mine: m.direction === "inbound", // applicant's own messages
    // Clean the greeting/sign-off off the company's (outbound) messages.
    body: m.direction === "outbound" ? cleanMessageBody(m.body as string) : (m.body as string),
    at: m.created_at as string,
  }));

  return (
    <main className="min-h-screen bg-gray-50">
      <PortalLive />
      <div className="mx-auto max-w-2xl px-4 py-6">
        <Link href="/portal/conversations" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-4 w-4" /> All conversations
        </Link>
        <h1 className="mt-2 mb-3 text-xl font-semibold text-gray-900">{app.company_name}</h1>
        <ConversationThread applicationId={applicationId} companyName={app.company_name} messages={messages} />
      </div>
    </main>
  );
}
