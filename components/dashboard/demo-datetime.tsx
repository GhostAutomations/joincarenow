"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

const HOURS = Array.from({ length: 14 }, (_, i) => String(i + 7).padStart(2, "0")); // 07–20
const MINUTES = ["00", "15", "30", "45"];

/** Inline calendar (click a day) + time dropdown. Emits "YYYY-MM-DDTHH:MM" in a
 *  hidden input — no native browser pickers, so it behaves consistently. */
export function DemoDateTime({ name }: { name: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [view, setView] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");

  const year = view.getFullYear();
  const month = view.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const value = date && hour && minute ? `${date}T${hour}:${minute}` : "";
  const selStyle = "rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="grid h-7 w-7 place-items-center rounded hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
        <span className="text-sm font-semibold text-gray-900">{view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="grid h-7 w-7 place-items-center rounded hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="mt-2 grid grid-cols-7 text-center text-[10px] font-medium uppercase text-gray-400">
        {WEEK.map((w) => <div key={w}>{w}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const cellYmd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const past = cellYmd < todayYmd;
          const selected = cellYmd === date;
          return (
            <button
              key={i}
              type="button"
              disabled={past}
              onClick={() => setDate(cellYmd)}
              className={`h-8 rounded-md text-sm transition ${selected ? "bg-brand-600 font-semibold text-white" : past ? "cursor-not-allowed text-gray-300" : "text-gray-700 hover:bg-brand-50"}`}
            >
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
        <span className="text-sm font-medium text-gray-700">Time</span>
        <select aria-label="Hour" value={hour} onChange={(e) => setHour(e.target.value)} className={selStyle}>
          <option value="">HH</option>
          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
        </select>
        <span className="text-sm text-gray-400">:</span>
        <select aria-label="Minute" value={minute} onChange={(e) => setMinute(e.target.value)} className={selStyle}>
          <option value="">MM</option>
          {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        {date && hour && minute && <span className="text-xs text-green-700">✓ selected</span>}
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
