"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { founderSetTier } from "@/modules/billing/admin-actions";

/** Founder control: put a company on Tier 2 (Ruby) or Tier 1 (Core). Also moves
 *  an active Stripe subscription onto the matching price + Ruby meter. */
export function RubyToggle({ companyId, enabled }: { companyId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      const fd = new FormData();
      fd.set("id", companyId);
      fd.set("tier", next ? "ruby" : "core");
      await founderSetTier(fd);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/40 bg-white/75 p-4 shadow-sm backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Ruby — Tier 2</p>
          <p className="text-xs text-gray-500">
            {on
              ? "On (Tier 2) — Ruby screens applicants; 40/month included, then 75p. An active subscription moves to the Tier 2 price."
              : "Off (Tier 1) — enable to put this company on Tier 2 with the Ruby assistant."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle Ruby"
        onClick={toggle}
        disabled={pending}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
          on ? "bg-brand-600" : "bg-gray-300"
        }`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${on ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
