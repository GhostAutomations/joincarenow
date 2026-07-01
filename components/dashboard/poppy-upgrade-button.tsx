"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { upgradeToPoppy } from "@/modules/billing/actions";

/** "Add Poppy" upgrade for an active Core company — swaps the live subscription
 *  to Tier 2 and turns Poppy on. */
export function PoppyUpgradeButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function go() {
    if (!confirm("Add Poppy to your plan? Your subscription moves to Tier 2 (£89/mo, or £79 on a 12-month term / £790/yr) and the difference is prorated to your next invoice.")) return;
    setError(null);
    start(async () => {
      const res = await upgradeToPoppy();
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" /> {pending ? "Adding…" : "Add Poppy"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
