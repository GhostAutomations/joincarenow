import { notFound } from "next/navigation";
import { getTalentPoolInvite } from "@/modules/applications/actions";
import { TalentPoolOptIn } from "@/components/talent-pool/opt-in";

export default async function TalentPoolPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getTalentPoolInvite(token);
  if (!invite) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
      </header>
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">
          {invite.firstName ? `Hi ${invite.firstName},` : "Join the talent pool"}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          {invite.companyName} would like to keep your details on file so they can get in touch
          when a suitable role comes up.
        </p>
        <TalentPoolOptIn token={token} companyName={invite.companyName} alreadyOpted={invite.opted} />
      </div>
    </main>
  );
}
