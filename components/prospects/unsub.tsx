"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { optOutByToken } from "@/modules/prospects/optout";

export function Unsub({ token, companyName, alreadyOut }: { token: string; companyName: string; alreadyOut: boolean }) {
  const [done, setDone] = useState(alreadyOut);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function optOut() {
    setBusy(true);
    setError(null);
    const r = await optOutByToken(token);
    setBusy(false);
    if (r?.error) return setError(r.error);
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
        <div className="flex items-center gap-2 font-medium"><Check className="h-5 w-5" /> You&apos;ve been unsubscribed</div>
        <p className="mt-1 text-sm text-green-700">You won&apos;t receive any more emails from us. Sorry to see you go.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-700">Unsubscribe from emails about Join Care Now?</p>
      <button
        onClick={optOut}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Unsubscribe me
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
