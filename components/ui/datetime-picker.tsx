"use client";

import { useState } from "react";

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const fieldClass =
  "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Date picker + separate hour and 15-minute dropdowns. Emits a combined
 *  "YYYY-MM-DDTHH:MM" value in a hidden input named `name`. */
export function DateTimePicker({
  name,
  defaultValue,
  minToday = true,
}: {
  name: string;
  defaultValue?: string;
  minToday?: boolean;
}) {
  const initDate = defaultValue ? defaultValue.slice(0, 10) : "";
  const initHour = defaultValue ? defaultValue.slice(11, 13) : "";
  const initMin = defaultValue ? defaultValue.slice(14, 16) : "";

  const [date, setDate] = useState(initDate);
  const [hour, setHour] = useState(HOURS.includes(initHour) ? initHour : "");
  const [minute, setMinute] = useState(MINUTES.includes(initMin) ? initMin : "");

  const value = date && hour && minute ? `${date}T${hour}:${minute}` : "";
  const today = new Date().toISOString().slice(0, 10);

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
        <select
          aria-label="Hour"
          value={hour}
          onChange={(e) => setHour(e.target.value)}
          className={fieldClass}
        >
          <option value="">HH</option>
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span className="text-gray-500">:</span>
        <select
          aria-label="Minutes"
          value={minute}
          onChange={(e) => setMinute(e.target.value)}
          className={fieldClass}
        >
          <option value="">MM</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
