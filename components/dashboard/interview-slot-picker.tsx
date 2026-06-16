"use client";

import { useState } from "react";
import { slotsForDate, isoWeekday, DAYS, type OpeningHours } from "@/lib/opening-hours";

export type BookedInterview = {
  scheduled_at: string;
  duration_minutes: number;
  interviewer_id: string | null;
};

/** Calendar-style slot picker: next open days, 30-min blocks within opening
 *  hours, with the chosen interviewer's existing interviews shown as booked.
 *  Emits "YYYY-MM-DDTHH:MM" in a hidden input named `name`. */
export function InterviewSlotPicker({
  name,
  openingHours,
  interviews,
  interviewerId,
  defaultValue,
  stepMin = 30,
  daysToShow = 7,
}: {
  name: string;
  openingHours: OpeningHours;
  interviews: BookedInterview[];
  interviewerId: string;
  defaultValue?: string;
  stepMin?: number;
  daysToShow?: number;
}) {
  // Build the next N open days (skipping closed days), starting today.
  const openDays: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < 60 && openDays.length < daysToShow; i++) {
    const ds = cursor.toISOString().slice(0, 10);
    if (slotsForDate(openingHours, ds, stepMin).length > 0) openDays.push(ds);
    cursor.setDate(cursor.getDate() + 1);
  }

  const initDate = defaultValue ? defaultValue.slice(0, 10) : openDays[0] ?? "";
  const [date, setDate] = useState(openDays.includes(initDate) ? initDate : openDays[0] ?? "");
  const [slot, setSlot] = useState(defaultValue ? defaultValue.slice(11, 16) : "");

  const slots = date ? slotsForDate(openingHours, date, stepMin) : [];

  // Minutes the chosen interviewer is busy on the selected day.
  const busy = new Set<string>();
  if (interviewerId && date) {
    for (const iv of interviews) {
      if (iv.interviewer_id !== interviewerId) continue;
      const start = new Date(iv.scheduled_at);
      const startDate = start.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
      if (startDate !== date) continue;
      const hm = start.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
      const startMin = parseInt(hm.slice(0, 2)) * 60 + parseInt(hm.slice(3, 5));
      for (let m = startMin; m < startMin + (iv.duration_minutes || 30); m += stepMin) {
        busy.add(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
      }
    }
  }

  const value = date && slot ? `${date}T${slot}` : "";

  function dayLabel(ds: string) {
    const d = new Date(`${ds}T00:00:00Z`);
    const wd = DAYS.find((x) => x.iso === isoWeekday(ds))?.label.slice(0, 3) ?? "";
    return { wd, num: d.getUTCDate(), mon: d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" }) };
  }

  if (openDays.length === 0) {
    return (
      <p className="text-xs text-amber-600">
        No opening hours set. Add them in Settings to schedule interviews.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Day chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {openDays.map((ds) => {
          const { wd, num, mon } = dayLabel(ds);
          const active = ds === date;
          return (
            <button
              key={ds}
              type="button"
              onClick={() => { setDate(ds); setSlot(""); }}
              className={`flex shrink-0 flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs ${
                active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span>{wd}</span>
              <span className="text-sm font-semibold">{num}</span>
              <span className="text-[10px] text-gray-400">{mon}</span>
            </button>
          );
        })}
      </div>

      {/* Time blocks */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
        {slots.map((s) => {
          const isBusy = busy.has(s);
          const selected = s === slot;
          return (
            <button
              key={s}
              type="button"
              disabled={isBusy}
              onClick={() => setSlot(s)}
              className={`rounded-md border px-2 py-1.5 text-xs font-medium ${
                selected
                  ? "border-brand-600 bg-brand-600 text-white"
                  : isBusy
                    ? "cursor-not-allowed border-gray-100 bg-gray-100 text-gray-300 line-through"
                    : "border-gray-200 text-gray-700 hover:border-brand-300 hover:bg-brand-50"
              }`}
            >
              {s}
            </button>
          );
        })}
      </div>
      {interviewerId === "" && (
        <p className="text-[11px] text-gray-400">Pick an interviewer to see their existing bookings.</p>
      )}

      <input type="hidden" name={name} value={value} />
    </div>
  );
}
