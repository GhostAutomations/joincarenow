"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { recordProposalResponse } from "@/modules/prospects/actions";

const PLAN_TEXT: Record<string, string> = {
  monthly: "Monthly — £49/month, cancel anytime (£150 one-off setup)",
  commit: "12-month plan — £49/month, no setup fee",
  annual: "Annual — £490/year (2 months free), no setup fee",
  diamond: "Diamond — free subscription & setup; you pay only for SMS and AI usage",
};

/** Public Accept / Decline page for a proposal. Requires an explicit click on
 *  this page (so email link scanners can't auto-respond). */
export function ProposalRespond({
  token,
  name,
  plan,
  offer,
  initialChoice,
  alreadyResponded,
}: {
  token: string;
  name: string;
  plan: string | null;
  offer: string | null;
  initialChoice: "accept" | "decline" | null;
  alreadyResponded: "accepted" | "declined" | null;
}) {
  const [done, setDone] = useState<"accepted" | "declined" | null>(alreadyResponded);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function respond(choice: "accepted" | "declined") {
    setError(null);
    startTransition(async () => {
      const r = await recordProposalResponse(token, choice);
      if (r.error) setError(r.error);
      else setDone(choice);
    });
  }

  if (done) {
    return (
      <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <div className={`mx-auto grid h-12 w-12 place-items-center rounded-full ${done === "accepted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
          {done === "accepted" ? <Check className="h-6 w-6" /> : <X className="h-6 w-6" />}
        </div>
        <h2 className="mt-3 text-lg font-semibold text-gray-900">
          {done === "accepted" ? "Thanks — we're delighted!" : "Thanks for letting us know"}
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          {done === "accepted"
            ? "Welcome aboard! We're setting up your account now — keep an eye on your inbox for an email to log in and get started."
            : "No problem at all. If anything changes, just reply to our email — we'd love to help."}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-gray-600">Your proposal for <span className="font-medium text-gray-900">{name}</span>:</p>
      <div className="mt-3 rounded-xl bg-gray-50 p-4 text-sm">
        <p className="font-medium text-gray-900">{plan ? PLAN_TEXT[plan] ?? plan : "Join Care Now — everything included"}</p>
        {offer && <p className="mt-1 text-green-700">Plus, as a thank-you: {offer}</p>}
        <p className="mt-2 text-gray-500">Everything is included — recruitment, onboarding and compliance in one place, plus 1 branch and 100 SMS a month.</p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => respond("accepted")}
          disabled={pending}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-70"
        >
          <Check className="h-4 w-4" /> {pending ? "Saving…" : "Accept proposal"}
        </button>
        {/* Hide Decline when they arrived via the Accept button; keep both when
            they arrived via Decline so they can still change their mind. */}
        {initialChoice !== "accept" && (
          <button
            onClick={() => respond("declined")}
            disabled={pending}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/40 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-white/60 disabled:opacity-70"
          >
            <X className="h-4 w-4" /> Decline
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-xs text-gray-400">
        {initialChoice === "accept"
          ? "Please confirm to accept your proposal."
          : initialChoice === "decline"
          ? "Changed your mind? You can still accept above."
          : "Choose an option above to confirm."}
      </p>
    </div>
  );
}
