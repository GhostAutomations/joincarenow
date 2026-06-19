"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { consentTalentPool } from "@/modules/applications/actions";

export function TalentPoolOptIn({
  token,
  companyName,
  alreadyOpted,
}: {
  token: string;
  companyName: string;
  alreadyOpted: boolean;
}) {
  const [done, setDone] = useState(alreadyOpted);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function optIn() {
    setBusy(true);
    setError(null);
    const r = await consentTalentPool(token);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5">
        <div className="flex items-center gap-2 text-green-800">
          <Check className="h-5 w-5" />
          <span className="font-medium">You&apos;re in the talent pool</span>
        </div>
        <p className="mt-1 text-sm text-green-700">
          Thanks — {companyName} will keep your details on file and be in touch if a suitable role
          comes up. You can ask to be removed at any time.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-700">
        We&apos;ll keep your details for up to 6 months so we can let you know about future
        opportunities. You can ask us to remove your details at any time.
      </p>
      <button
        onClick={optIn}
        disabled={busy}
        className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Yes, keep me in the talent pool
      </button>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
