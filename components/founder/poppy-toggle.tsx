"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { setCompanyPoppyEnabled } from "@/modules/poppy/actions";

/** Founder control: turn the Poppy AI assistant on/off for a company. */
export function PoppyToggle({ companyId, enabled }: { companyId: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimistic
    start(async () => {
      await setCompanyPoppyEnabled(companyId, next);
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
          <p className="text-sm font-semibold text-gray-900">Poppy — AI assistant</p>
          <p className="text-xs text-gray-500">
            {on
              ? "On — Poppy drafts interview questions from each applicant's CV + application vs the job description."
              : "Off — enable to give this company the Poppy AI assistant."}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle Poppy"
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
