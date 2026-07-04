"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coins, RefreshCw } from "lucide-react";
import { founderMigrateCorePrices, founderRunUsageReport } from "@/modules/billing/admin-actions";

type Res = { changed: number; skipped: number; errors: number };

/** Founder-only billing maintenance actions. Ruby is added/removed per company
 *  from the company's billing page, not in bulk here. */
export function FounderBillingTools() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(kind: "migrate" | "usage") {
    if (kind === "migrate" && !confirm("Move every Core subscriber onto the current £49/£490 price? Run this only after the new Stripe prices are set.")) return;
    setMsg(null);
    start(async () => {
      if (kind === "usage") {
        await founderRunUsageReport();
        setMsg("Usage reported to Stripe.");
      } else {
        const r: Res = await founderMigrateCorePrices();
        setMsg(`${r.changed} changed · ${r.skipped} skipped · ${r.errors} error${r.errors === 1 ? "" : "s"}.`);
      }
      router.refresh();
    });
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur transition hover:bg-white/30 disabled:opacity-60";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button type="button" onClick={() => run("migrate")} disabled={pending} className={btn}>
        <Coins className="h-4 w-4" /> Migrate Core prices
      </button>
      <button type="button" onClick={() => run("usage")} disabled={pending} className={btn}>
        <RefreshCw className="h-4 w-4" /> Report usage now
      </button>
      {msg && <span className="text-sm text-white/85">{msg}</span>}
    </div>
  );
}
