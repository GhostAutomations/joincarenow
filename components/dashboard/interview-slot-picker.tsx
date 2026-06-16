"use client";

import { useState } from "react";
import { slotsForDate, isoWeekday, type OpeningHours } from "@/lib/opening-hours";

export type BookedInterview = {
  scheduled_at: string;
  duration_minutes: number;
  interviewer_id: string | null;
};

const toMin = (hm: string) => parseInt(hm.slice(0, 2)) * 60 + parseInt(hm.slice(3, 5));
const fromMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Week-grid slot picker: open days as columns, 30-min time rows. The chosen
 *  interviewer's existing interviews are blocked out. Emits "YYYY-MM-DDTHH:MM". */
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
  // Next N open days (skip closed days).
  const openDays: string[] = [];
  const cursor = new Date();
  for (let i = 0; i < 60 && openDays.length < daysToShow; i++) {
    const ds = cursor.toISOString().slice(0, 10);
    if (slotsForDate(openingHours, ds, stepMin).length > 0) openDays.push(ds);
    cursor.setDate(cursor.getDate() + 1);
  }

  const [value, setValue] = useState(defaultValue ?? "");

  if (openDays.length === 0) {
    return (
      <p className="text-xs text-amber-600">
        No opening hours set. Add them in Settings to schedule interviews.
      </p>
    );
  }

  // Per-day open/close minutes, and overall time-row range across shown days.
  const dayHours = openDays.map((ds) => {
    const h = openingHours[isoWeekday(ds)];
    return { ds, open: h ? toMin(h.open) : null, close: h ? toMin(h.close) : null };
  });
  const minOpen = Math.min(...dayHours.map((d) => d.open ?? 24 * 60));
  const maxClose = Math.max(...dayHours.map((d) => d.close ?? 0));
  const rows: number[] = [];
  for (let m = minOpen; m < maxClose; m += stepMin) rows.push(m);

  // Busy minutes per day for the chosen interviewer.
  const busy = new Map<string, Set<number>>();
  if (interviewerId) {
    for (const iv of interviews) {
      if (iv.interviewer_id !== interviewerId) continue;
      const start = new Date(iv.scheduled_at);
      const ds = start.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
      const hm = start.toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hour12: false });
      const s = toMin(hm);
      const set = busy.get(ds) ?? new Set<number>();
      for (let m = s; m < s + (iv.duration_minutes || stepMin); m += stepMin) set.add(m);
      busy.set(ds, set);
    }
  }

  function label(ds: string) {
    const d = new Date(`${ds}T00:00:00Z`);
    return {
      wd: d.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" }),
      num: d.getUTCDate(),
    };
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <div
        className="min-w-[460px]"
        style={{ display: "grid", gridTemplateColumns: `48px repeat(${openDays.length}, minmax(56px,1fr))` }}
      >
        {/* Header */}
        <div className="border-b border-gray-200 bg-gray-50" />
        {openDays.map((ds) => {
          const { wd, num } = label(ds);
          return (
            <div key={ds} className="border-b border-l border-gray-200 bg-gray-50 px-1 py-1 text-center text-[11px] text-gray-600">
              {wd} <span className="font-semibold text-gray-900">{num}</span>
            </div>
          );
        })}

        {/* Rows */}
        {rows.map((m) => (
          <RowCells
            key={m}
            m={m}
            openDays={openDays}
            dayHours={dayHours}
            busy={busy}
            value={value}
            setValue={setValue}
          />
        ))}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}

function RowCells({
  m, openDays, dayHours, busy, value, setValue,
}: {
  m: number;
  openDays: string[];
  dayHours: { ds: string; open: number | null; close: number | null }[];
  busy: Map<string, Set<number>>;
  value: string;
  setValue: (v: string) => void;
}) {
  const time = fromMin(m);
  return (
    <>
      <div className="border-b border-gray-100 px-1 py-1.5 text-right text-[10px] text-gray-400">{time}</div>
      {openDays.map((ds, i) => {
        const dh = dayHours[i];
        const inHours = dh.open != null && dh.close != null && m >= dh.open && m < dh.close;
        const isBusy = busy.get(ds)?.has(m);
        const slotVal = `${ds}T${time}`;
        const selected = value === slotVal;

        if (!inHours) {
          return <div key={ds} className="border-b border-l border-gray-100 bg-gray-50/60" />;
        }
        return (
          <button
            key={ds}
            type="button"
            disabled={isBusy}
            onClick={() => setValue(slotVal)}
            className={`border-b border-l border-gray-100 ${
              selected
                ? "bg-brand-600"
                : isBusy
                  ? "cursor-not-allowed bg-gray-200"
                  : "hover:bg-brand-50"
            }`}
            title={isBusy ? "Already booked" : time}
          >
            {selected ? (
              <span className="block text-center text-[10px] font-semibold text-white">✓</span>
            ) : isBusy ? (
              <span className="block text-center text-[9px] text-gray-400">busy</span>
            ) : null}
          </button>
        );
      })}
    </>
  );
}
