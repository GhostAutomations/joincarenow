import { notFound } from "next/navigation";
import { getUnsubInfo } from "@/modules/prospects/optout";
import { Unsub } from "@/components/prospects/unsub";

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getUnsubInfo(token);
  if (!info) notFound();

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="flex h-14 items-center border-b border-gray-200 bg-white px-4 sm:px-6">
        <span className="text-base font-bold text-brand-700">Join Care Now</span>
      </header>
      <div className="mx-auto max-w-xl px-6 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Email preferences</h1>
        <Unsub token={token} companyName={info.companyName} alreadyOut={info.opted} />
      </div>
    </main>
  );
}
