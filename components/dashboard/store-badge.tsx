import { Store } from "lucide-react";

/** Format pence as a £ price. */
export function formatPrice(pence: number): string {
  return "£" + (pence / 100).toFixed(2);
}

/** Gold marker (the File Store app icon, in gold) shown on forms that come
 *  from the File Store. */
export function StoreBadge() {
  return (
    <span
      title="From the File Store"
      className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-sm ring-1 ring-amber-300"
    >
      <Store className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
    </span>
  );
}

/** Price pill. Consistent across founder + company screens: free is neutral
 *  slate (never green); a paid price is amber. */
export function PriceBadge({ pricePence }: { pricePence: number }) {
  const isFree = !pricePence || pricePence <= 0;
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
        isFree ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700"
      }`}
    >
      {isFree ? "Free" : formatPrice(pricePence)}
    </span>
  );
}
