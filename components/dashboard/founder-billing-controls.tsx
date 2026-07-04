"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Gift, XCircle, RotateCcw, Sparkles, Clock } from "lucide-react";
import {
  founderCompToggle,
  founderCancelSubscription,
  founderResetBilling,
  founderSetTier,
  founderOfferRuby,
  founderWithdrawRubyOffer,
} from "@/modules/billing/admin-actions";

export function FounderBillingControls({
  companyId,
  comped,
  hasSubscription,
  ruby,
  offerPending,
}: {
  companyId: string;
  comped: boolean;
  hasSubscription: boolean;
  /** Whether the company is currently on Ruby (Tier 2 / Diamond+Ruby). */
  ruby: boolean;
  /** Whether a Ruby offer has been sent and is awaiting the admin's acceptance. */
  offerPending: boolean;
}) {
  const router = useRouter();

  // While a Ruby offer is pending, poll so this control flips to "Remove Ruby"
  // the moment the company admin accepts — without the founder refreshing.
  useEffect(() => {
    if (!offerPending) return;
    const t = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(t);
  }, [offerPending, router]);

  const confirmSubmit = (msg: string) => (e: React.FormEvent<HTMLFormElement>) => {
    if (!confirm(msg)) e.preventDefault();
  };

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Founder controls</h2>
      <p className="mt-1 text-xs text-gray-500">Manual overrides. These affect the customer&apos;s billing — use with care.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {/* Ruby: already on → remove immediately; offer pending → withdraw;
            otherwise → send the admin an offer to accept (they authorise billing). */}
        {ruby ? (
          <form
            action={founderSetTier}
            onSubmit={confirmSubmit("Remove Ruby from this company? Their subscription moves back to Core (Tier 1) pricing and Ruby is turned off.")}
          >
            <input type="hidden" name="id" value={companyId} />
            <input type="hidden" name="tier" value="core" />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-100">
              <Sparkles className="h-4 w-4" /> Remove Ruby
            </button>
          </form>
        ) : offerPending ? (
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
              <Clock className="h-4 w-4" /> Ruby offer sent — awaiting acceptance
            </span>
            <form action={founderWithdrawRubyOffer} onSubmit={confirmSubmit("Withdraw the pending Ruby offer?")}>
              <input type="hidden" name="id" value={companyId} />
              <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/60">
                <XCircle className="h-4 w-4" /> Withdraw
              </button>
            </form>
          </div>
        ) : (
          <form
            action={founderOfferRuby}
            onSubmit={confirmSubmit("Send this company an offer to add Ruby? Their admin will get an email + an in-app prompt to accept and authorise the billing. Nothing changes until they accept.")}
          >
            <input type="hidden" name="id" value={companyId} />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-1.5 text-sm font-medium text-fuchsia-700 hover:bg-fuchsia-100">
              <Sparkles className="h-4 w-4" /> Add Ruby
            </button>
          </form>
        )}

        {/* Comp / un-comp */}
        <form action={founderCompToggle} onSubmit={confirmSubmit(comped ? "Remove complimentary access from this company?" : "Give this company free (complimentary) access?")}>
          <input type="hidden" name="id" value={companyId} />
          <input type="hidden" name="comp" value={comped ? "false" : "true"} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-100">
            <Gift className="h-4 w-4" /> {comped ? "Remove complimentary" : "Give complimentary access"}
          </button>
        </form>

        {/* Cancel subscription */}
        {hasSubscription && (
          <form action={founderCancelSubscription} onSubmit={confirmSubmit("Cancel this subscription at the end of the current period?")}>
            <input type="hidden" name="id" value={companyId} />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
              <XCircle className="h-4 w-4" /> Cancel at period end
            </button>
          </form>
        )}

        {/* Reset stale Stripe link */}
        <form action={founderResetBilling} onSubmit={confirmSubmit("Clear this company's Stripe link and reset its billing to 'none'? Use this if the Stripe customer was deleted. They'll need to re-subscribe.")}>
          <input type="hidden" name="id" value={companyId} />
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/60">
            <RotateCcw className="h-4 w-4" /> Reset Stripe link
          </button>
        </form>
      </div>
    </div>
  );
}
