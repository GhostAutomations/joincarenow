"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Check, X } from "lucide-react";
import { acceptPoppyOffer, declinePoppyOffer } from "@/modules/billing/actions";

/** Shown on the Billing page and Dashboard when the founder has offered Poppy.
 *  Accepting is what authorises the new billing and applies the change.
 *  `variant="dark"` styles it as a glassy card for the gradient dashboard. */
export function PoppyOfferBanner({ diamond, variant = "light" }: { diamond: boolean; variant?: "light" | "dark" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dark = variant === "dark";

  const priceLine = diamond
    ? "40 applicant screens each month are included, then 75p each — added to your usage-only plan."
    : "Your plan moves to Tier 2 — £89/month (or £79/month on a 12-month term, or £790/year) — including 40 applicant screens each month, then 75p each.";

  function act(accept: boolean) {
    setError(null);
    start(async () => {
      const res = accept ? await acceptPoppyOffer() : await declinePoppyOffer();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div
      className={
        dark
          ? "mt-6 overflow-hidden rounded-2xl border border-white/25 bg-white/15 p-5 shadow-sm backdrop-blur-md"
          : "mt-6 overflow-hidden rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-fuchsia-50 to-violet-50 p-5 shadow-sm"
      }
    >
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${dark ? "text-white" : "text-gray-900"}`}>
            Add Poppy, your AI recruitment assistant?
          </p>
          <p className={`mt-1 text-sm ${dark ? "text-white/85" : "text-gray-700"}`}>
            Poppy screens your applicants for you — reviewing each application, asking the candidate
            a few follow-up questions, and giving you a clear hire recommendation. {priceLine}
          </p>
          <p className={`mt-1 text-xs ${dark ? "text-white/60" : "text-gray-500"}`}>
            Accepting authorises the updated billing on your saved payment method. You can remove Poppy later.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => act(true)}
              disabled={pending}
              className={
                dark
                  ? "inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white/90 disabled:opacity-60"
                  : "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              }
            >
              <Check className="h-4 w-4" /> {pending ? "Applying…" : "Accept & authorise billing"}
            </button>
            <button
              type="button"
              onClick={() => act(false)}
              disabled={pending}
              className={
                dark
                  ? "inline-flex items-center gap-1.5 rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-60"
                  : "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-white/60 disabled:opacity-60"
              }
            >
              <X className="h-4 w-4" /> No thanks
            </button>
            {error && <span className={`text-sm ${dark ? "text-red-200" : "text-red-600"}`}>{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
