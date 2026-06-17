import { Store } from "lucide-react";

/** Gold marker shown on forms that originated from the Form Store. */
export function StoreBadge({ withLabel = false }: { withLabel?: boolean }) {
  return (
    <span
      title="From the Form Store"
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 ring-1 ring-amber-200"
    >
      <Store className="h-3.5 w-3.5" aria-hidden />
      {withLabel && "Form Store"}
    </span>
  );
}
