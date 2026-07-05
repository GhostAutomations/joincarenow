"use client";

import { useActionState } from "react";
import { setRetentionSettings, type RetentionState } from "@/modules/privacy/actions";

export type RetentionPrefs = {
  unsuccessful?: { enabled?: boolean; months?: number };
  leavers?: { enabled?: boolean; years?: number };
};

export function RetentionSettingsForm({ prefs }: { prefs: RetentionPrefs }) {
  const [state, action] = useActionState<RetentionState, FormData>(setRetentionSettings, undefined);
  const u = prefs.unsuccessful ?? {};
  const l = prefs.leavers ?? {};

  return (
    <form action={action} className="mt-2 space-y-5">
      <p className="text-xs text-gray-500">
        Automatically and permanently erase personal data once your retention period has passed.
        Both are off until you switch them on. Talent-pool candidates who consented are handled
        separately and are never erased by these rules while their consent is live.
      </p>

      <div className="rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" name="unsuccessfulEnabled" defaultChecked={u.enabled ?? false} />
          Erase unsuccessful applicants
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Candidates who were not progressed (all their applications rejected, never hired).
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          After
          <input
            type="number"
            name="unsuccessfulMonths"
            min={1}
            max={120}
            defaultValue={u.months ?? 6}
            className="w-20 rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-sm"
          />
          months
        </div>
      </div>

      <div className="rounded-xl border border-white/50 bg-white/60 p-4 backdrop-blur">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" name="leaversEnabled" defaultChecked={l.enabled ?? false} />
          Erase leavers
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Former employees, measured from their leaving date. Check your legal and tax retention
          duties before enabling; care-sector staff records are often kept for several years.
        </p>
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
          After
          <input
            type="number"
            name="leaversYears"
            min={1}
            max={25}
            defaultValue={l.years ?? 6}
            className="w-20 rounded-lg border border-white/50 bg-white/70 px-2 py-1 text-sm"
          />
          years
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save retention settings
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
