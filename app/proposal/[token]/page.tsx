import { notFound } from "next/navigation";
import { getProposalByToken } from "@/modules/prospects/actions";
import { ProposalRespond } from "@/components/dashboard/proposal-respond";

export default async function ProposalTokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ r?: string }>;
}) {
  const { token } = await params;
  const { r } = await searchParams;
  const proposal = await getProposalByToken(token);
  if (!proposal) notFound();

  const initialChoice = r === "accept" ? "accept" : r === "decline" ? "decline" : null;
  const alreadyResponded =
    proposal.response === "accepted" ? "accepted" : proposal.response === "declined" ? "declined" : null;

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
      </header>
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Your Join Care Now proposal</h1>
        <p className="mt-2 text-sm text-gray-600">Review the proposal below and let us know your decision.</p>
        <ProposalRespond
          token={token}
          name={proposal.name}
          plan={proposal.plan}
          offer={proposal.offer}
          initialChoice={initialChoice}
          alreadyResponded={alreadyResponded}
        />
      </div>
    </main>
  );
}
