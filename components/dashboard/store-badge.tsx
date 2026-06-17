import { Store } from "lucide-react";
import { TIER_LABEL } from "@/modules/forms/tiers";

/** Gold marker (the Form Store app icon, in gold) shown on forms that come
 *  from the Form Store. */
export function StoreBadge() {
  return (
    <span
      title="From the Form Store"
      className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-1 ring-amber-300"
    >
      <Store className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
    </span>
  );
}

/** Subscription-tier pill. Consistent across founder + company screens:
 *  Free is neutral slate (never green); paid tiers are amber. */
export function TierBadge({ tier }: { tier: string }) {
  const isFree = tier === "free";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        isFree ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
      }`}
    >
      {TIER_LABEL[tier] ?? tier}
    </span>
  );
}
