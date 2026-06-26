"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setReminderSettings, type SettingsState } from "@/modules/companies/actions";

export type ReminderPrefs = Record<
  string,
  {
    enabled?: boolean;
    channel?: "email" | "sms" | "both";
    hoursBefore?: number;
    afterDays?: number;
    repeatDays?: number;
    daysBefore?: number;
  }
>;

type TimingInput = { field: string; label: string; def: number; min: number; max: number; unit: string };

const ROWS: { key: string; label: string; blurb: string; inputs: TimingInput[] }[] = [
  {
    key: "interview",
    label: "Interview reminder",
    blurb: "Sent before a confirmed interview.",
    inputs: [{ field: "hoursBefore", label: "Hours before", def: 24, min: 1, max: 72, unit: "hours" }],
  },
  {
    key: "docs",
    label: "Missing-document chaser",
    blurb: "Chases outstanding items the applicant still needs to complete.",
    inputs: [
      { field: "afterDays", label: "Start after", def: 3, min: 1, max: 30, unit: "days" },
      { field: "repeatDays", label: "Repeat every", def: 3, min: 1, max: 30, unit: "days" },
    ],
  },
  {
    key: "onboarding",
    label: "Onboarding task nudge",
    blurb: "Sent when onboarding tasks are due soon.",
    inputs: [{ field: "daysBefore", label: "Days before due", def: 2, min: 1, max: 14, unit: "days" }],
  },
  {
    key: "start_date",
    label: "Start-date reminder",
    blurb: "Sent before the new starter's first day.",
    inputs: [{ field: "daysBefore", label: "Days before", def: 1, min: 1, max: 14, unit: "days" }],
  },
];

export function ReminderSettingsForm({
  companyId,
  prefs,
  submitLabel = "Save",
}: {
  companyId: string;
  prefs: ReminderPrefs;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(setReminderSettings, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />

      <p className="text-xs text-gray-500">
        Reminders are sent automatically. Turn each one on or off, choose how it&apos;s sent, and
        set the timing. To protect applicants, reminders only ever go out between 8am and 8pm.
      </p>

      <div className="divide-y divide-gray-100">
        {ROWS.map((r) => {
          const p = (prefs[r.key] ?? {}) as ReminderPrefs[string];
          const enabled = p.enabled ?? true;
          const channel = p.channel ?? "both";
          return (
            <div key={r.key} className="py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    name={`${r.key}_enabled`}
                    defaultChecked={enabled}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">{r.label}</span>
                    <br />
                    <span className="text-xs text-gray-400">{r.blurb}</span>
                  </span>
                </label>
                <label className="text-xs font-medium text-gray-600">
                  Send by
                  <select
                    name={`${r.key}_channel`}
                    defaultValue={channel}
                    className="ml-2 rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="both">Email &amp; SMS</option>
                  </select>
                </label>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-4 pl-7">
                {r.inputs.map((inp) => {
                  const current = (p[inp.field as keyof typeof p] as number | undefined) ?? inp.def;
                  return (
                    <label key={inp.field} className="flex items-center gap-2 text-xs text-gray-600">
                      {inp.label}
                      <input
                        type="number"
                        name={`${r.key}_${inp.field}`}
                        defaultValue={current}
                        min={inp.min}
                        max={inp.max}
                        className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <span className="text-gray-400">{inp.unit}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {submitLabel}
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
