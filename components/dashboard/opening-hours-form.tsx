"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setOpeningHours, type SettingsState } from "@/modules/companies/actions";
import { DAYS, type OpeningHours } from "@/lib/opening-hours";

export function OpeningHoursForm({
  companyId,
  hours,
  submitLabel = "Save opening hours",
}: {
  companyId: string;
  hours: OpeningHours;
  submitLabel?: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(setOpeningHours, undefined);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  // Local state per day so toggling open/closed shows/hides the time inputs.
  const [days, setDays] = useState(() =>
    DAYS.map((d) => {
      const h = hours?.[d.iso];
      return { iso: d.iso, label: d.label, open: !!h, from: h?.open ?? "09:00", to: h?.close ?? "17:00" };
    })
  );

  function update(iso: string, patch: Partial<{ open: boolean; from: string; to: string }>) {
    setDays((prev) => prev.map((d) => (d.iso === iso ? { ...d, ...patch } : d)));
  }

  return (
    <form action={action} className="mt-4 space-y-2">
      <input type="hidden" name="companyId" value={companyId} />
      {days.map((d) => (
        <div key={d.iso} className="flex flex-wrap items-center gap-3">
          <label className="flex w-32 items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              name={`open_${d.iso}`}
              checked={d.open}
              onChange={(e) => update(d.iso, { open: e.target.checked })}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            {d.label}
          </label>
          {d.open ? (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="time"
                name={`from_${d.iso}`}
                step={900}
                value={d.from}
                onChange={(e) => update(d.iso, { from: e.target.value })}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
              <span>to</span>
              <input
                type="time"
                name={`to_${d.iso}`}
                step={900}
                value={d.to}
                onChange={(e) => update(d.iso, { to: e.target.value })}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </div>
          ) : (
            <span className="text-sm text-gray-400">Closed</span>
          )}
        </div>
      ))}

      <div className="flex items-center gap-3 pt-2">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {submitLabel}
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
