"use client";

import { useState } from "react";

// "HH:MM" every 15 minutes, 00:00 → 23:45
const TIMES: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIMES.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const inputClass =
  "rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Date picker + 15-minute time dropdown. Emits a combined
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
  const initTime = defaultValue ? defaultValue.slice(11, 16) : "";
  const [date, setDate] = useState(initDate);
  // Only keep the time if it lands on a 15-min slot we offer.
  const [time, setTime] = useState(TIMES.includes(initTime) ? initTime : "");

  const value = date && time ? `${date}T${time}` : "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex gap-2">
      <input
        type="date"
        value={date}
        min={minToday ? today : undefined}
        onChange={(e) => setDate(e.target.value)}
        className={inputClass}
      />
      <select
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className={inputClass}
      >
        <option value="">--:--</option>
        {TIMES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
