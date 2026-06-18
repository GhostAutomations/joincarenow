"use client";

import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { respondToOffer } from "@/modules/offers/actions";

export type TokenOffer = {
  token: string;
  status: string;
  role: string | null;
  startDate: string | null;
  pay: string | null;
  hours: string | null;
  conditional: boolean;
  conditions: string | null;
  message: string | null;
  companyName: string;
  jobTitle: string | null;
  firstName: string | null;
};

export function OfferRespond({ offer }: { offer: TokenOffer }) {
  const [status, setStatus] = useState(offer.status);
  const [busy, setBusy] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(r: "accepted" | "declined") {
    setBusy(r);
    setError(null);
    const res = await respondToOffer(offer.token, r);
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setStatus(r);
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        {offer.conditional ? "Conditional job offer" : "Job offer"} — {offer.companyName}
      </h2>
      {offer.role && <p className="mt-1 text-sm text-gray-600">{offer.role}</p>}

      <div className="mt-4">
        {offer.startDate && <Row label="Start date" value={new Date(offer.startDate).toLocaleDateString("en-GB")} />}
        {offer.pay && <Row label="Pay" value={offer.pay} />}
        {offer.hours && <Row label="Hours" value={offer.hours} />}
        {offer.conditional && offer.conditions && <Row label="Conditions" value={offer.conditions} />}
      </div>

      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{offer.message}</p>
      )}

      {status === "accepted" ? (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4" /> Offer accepted</p>
          <p className="mt-1">Thank you — {offer.companyName} will be in touch with next steps.</p>
        </div>
      ) : status === "declined" ? (
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          You&apos;ve declined this offer. Thank you for letting us know.
        </div>
      ) : (
        <div className="mt-5">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => respond("accepted")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {busy === "accepted" ? "Saving…" : "Accept offer"}
            </button>
            <button
              onClick={() => respond("declined")}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              <X className="h-4 w-4" /> {busy === "declined" ? "Saving…" : "Decline"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
