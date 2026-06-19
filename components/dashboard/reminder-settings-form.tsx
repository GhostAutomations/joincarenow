"use client";

import { useActionState } from "react";
import { setReminderSettings, type SettingsState } from "@/modules/companies/actions";

export type ReminderPrefs = Record<
  string,
  { enabled?: boolean; channel?: "email" | "sms" | "both" }
>;

const ROWS: { key: string; label: string; timing: string }[] = [
  { key: "interview", label: "Interview reminder", timing: "Sent ~24 hours before a confirmed interview" },
  { key: "docs", label: "Missing-document chaser", timing: "Chases outstanding items after 3 days, then every 3 days" },
  { key: "onboarding", label: "Onboarding task nudge", timing: "Sent when onboarding tasks are due within 2 days" },
  { key: "start_date", label: "Start-date reminder", timing: "Sent the day before the new starter's first day" },
];

export function ReminderSettingsForm({
  companyId,
  prefs,
}: {
  companyId: string;
  prefs: ReminderPrefs;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(setReminderSettings, undefined);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />

      <p className="text-xs text-gray-500">
        Reminders are sent automatically. Turn each one on or off and choose how it&apos;s sent.
        Timings are fixed for now.
      </p>

      <div className="divide-y divide-gray-100">
        {ROWS.map((r) => {
          const p = prefs[r.key] ?? {};
          const enabled = p.enabled ?? true;
          const channel = p.channel ?? "both";
          return (
            <div key={r.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
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
                  <span className="text-xs text-gray-400">{r.timing}</span>
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
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
