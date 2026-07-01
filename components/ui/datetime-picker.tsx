"use client";

import { useState } from "react";
import { slotsForDate, hasOpeningHours, isoWeekday, DAYS, type OpeningHours } from "@/lib/opening-hours";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const fieldClass =
  "rounded-md border border-white/40 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Date picker + time selection, emitting "YYYY-MM-DDTHH:MM" in a hidden input.
 *  If `openingHours` are provided, only open days/times can be chosen. */
export function DateTimePicker({
  name,
  defaultValue,
  minToday = true,
  openingHours,
}: {
  name: string;
  defaultValue?: string;
  minToday?: boolean;
  openingHours?: OpeningHours | null;
}) {
  const initDate = defaultValue ? defaultValue.slice(0, 10) : "";
  const initHour = defaultValue ? defaultValue.slice(11, 13) : "";
  const initMin = defaultValue ? defaultValue.slice(14, 16) : "";

  const [date, setDate] = useState(initDate);
  const [hour, setHour] = useState(HOURS.includes(initHour) ? initHour : "");
  const [minute, setMinute] = useState(MINUTES.includes(initMin) ? initMin : "");
  const [slot, setSlot] = useState(initHour && initMin ? `${initHour}:${initMin}` : "");

  const today = new Date().toISOString().slice(0, 10);
  const constrained = hasOpeningHours(openingHours);

  // --- Constrained (opening-hours) mode ---
  if (constrained) {
    const slots = date ? slotsForDate(openingHours, date) : [];
    const dayLabel = date ? DAYS.find((d) => d.iso === isoWeekday(date))?.label : "";
    const closed = !!date && slots.length === 0;
    const value = date && slot && slots.includes(slot) ? `${date}T${slot}` : "";

    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={date}
            min={minToday ? today : undefined}
            onChange={(e) => { setDate(e.target.value); setSlot(""); }}
            className={fieldClass}
          />
          <select
            aria-label="Time"
            value={slot}
            onChange={(e) => setSlot(e.target.value)}
            disabled={!date || closed}
            className={fieldClass}
          >
            <option value="">{date ? "Pick a time" : "Pick a date first"}</option>
            {slots.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        {closed && (
          <p className="text-xs text-amber-600">
            The office is closed on {dayLabel}. Please pick another day.
          </p>
        )}
        <input type="hidden" name={name} value={value} />
      </div>
    );
  }

  // --- Legacy mode (no opening hours configured) ---
  const value = date && hour && minute ? `${date}T${hour}:${minute}` : "";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="date"
        value={date}
        min={minToday ? today : undefined}
        onChange={(e) => setDate(e.target.value)}
        className={fieldClass}
      />
      <div className="flex items-center gap-1">
        <select aria-label="Hour" value={hour} onChange={(e) => setHour(e.target.value)} className={fieldClass}>
          <option value="">HH</option>
          {HOURS.map((h) => (<option key={h} value={h}>{h}</option>))}
        </select>
        <span className="text-gray-500">:</span>
        <select aria-label="Minutes" value={minute} onChange={(e) => setMinute(e.target.value)} className={fieldClass}>
          <option value="">MM</option>
          {MINUTES.map((m) => (<option key={m} value={m}>{m}</option>))}
        </select>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
