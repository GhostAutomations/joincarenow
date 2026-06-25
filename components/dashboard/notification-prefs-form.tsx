"use client";

import { useActionState } from "react";
import { setNotificationPrefs, type NotificationPrefs, type PrefsState } from "@/modules/notifications/actions";

const ROWS: { key: keyof NotificationPrefs; label: string; blurb: string }[] = [
  { key: "new_application", label: "New applications", blurb: "When someone applies to a job you manage." },
  { key: "applicant_message", label: "Applicant messages", blurb: "When an applicant replies by email, SMS or in their portal." },
];

export function NotificationPrefsForm({ prefs }: { prefs: NotificationPrefs }) {
  const [state, action] = useActionState<PrefsState, FormData>(setNotificationPrefs, undefined);

  return (
    <form action={action} className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-gray-100 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
        <span>Notify me about</span>
        <span className="w-16 text-center">In-app</span>
        <span className="w-16 text-center">Email</span>
      </div>

      {ROWS.map((r) => {
        const p = prefs[r.key];
        return (
          <div key={r.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 border-b border-gray-50 py-3">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.label}</p>
              <p className="text-xs text-gray-500">{r.blurb}</p>
            </div>
            <div className="w-16 text-center">
              <input
                type="checkbox"
                name={`${r.key}_inApp`}
                defaultChecked={p.inApp}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
            </div>
            <div className="w-16 text-center">
              <input
                type="checkbox"
                name={`${r.key}_email`}
                defaultChecked={p.email}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
            </div>
          </div>
        );
      })}

      <div className="flex items-center gap-3 pt-4">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save preferences
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
