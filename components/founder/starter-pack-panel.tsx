"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Sparkles } from "lucide-react";
import { applyStarterPack, type SetupState } from "@/modules/setup/actions";

const INCLUDES = [
  "Care Worker Application form (ready to use)",
  "Emergency contact & availability onboarding forms",
  "10-step onboarding workflow (RTW, DBS, references, policies, contract…)",
  "Branded email + SMS templates for every stage",
  "A sample Care Assistant job (draft, ready to publish)",
  "Communication reminders + careers-page defaults switched on",
];

export function StarterPackPanel({
  companyId,
  seeded,
  seededAt,
}: {
  companyId: string;
  seeded: boolean;
  seededAt?: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<SetupState, FormData>(applyStarterPack, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const isDone = seeded || (state?.ok && !state?.error);
  const when = seededAt
    ? new Date(seededAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-5 shadow-sm backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-brand-600/10 p-2 text-brand-700">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Full company setup</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Load this company with a complete, ready-to-use configuration so their team can start
              straight away — what makes the £150 setup worth it.
            </p>
          </div>
        </div>
        {isDone && (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Applied{when ? ` · ${when}` : ""}
          </span>
        )}
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm text-gray-700 sm:grid-cols-2">
        {INCLUDES.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {!isDone && (
        <form action={action} className="mt-5 flex items-center gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Apply full setup
          </button>
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
        </form>
      )}

      {isDone && (
        <p className="mt-4 text-xs text-gray-500">
          Everything below is now in the company&apos;s account. They can edit, add to or remove any of
          it. Branding, contracts and policies can still be tailored in the sections below.
        </p>
      )}
    </div>
  );
}
