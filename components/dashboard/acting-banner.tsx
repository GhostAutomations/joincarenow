import { Eye } from "lucide-react";
import { stopManaging } from "@/modules/founder/actions";

/** Shown across the top of the dashboard when a Founder is "managing as" a
 *  company, with a one-click way back to the Founder console. */
export function ActingBanner({ companyName }: { companyName: string }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-amber-500 px-4 py-1.5 text-sm text-amber-950 sm:px-6">
      <span className="inline-flex items-center gap-2 font-medium">
        <Eye className="h-4 w-4" />
        Managing as {companyName}
      </span>
      <form action={stopManaging}>
        <button className="rounded-md bg-amber-950/10 px-2.5 py-1 text-xs font-semibold hover:bg-amber-950/20">
          Stop managing
        </button>
      </form>
    </div>
  );
}
