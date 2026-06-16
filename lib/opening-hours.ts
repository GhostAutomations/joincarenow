// Company office opening hours, keyed by ISO weekday ("1"=Mon … "7"=Sun).
// A null/absent day means closed. Times are "HH:MM" UK wall-clock.

export type DayHours = { open: string; close: string } | null;
export type OpeningHours = Record<string, DayHours>;

export const DAYS: { iso: string; label: string }[] = [
  { iso: "1", label: "Monday" },
  { iso: "2", label: "Tuesday" },
  { iso: "3", label: "Wednesday" },
  { iso: "4", label: "Thursday" },
  { iso: "5", label: "Friday" },
  { iso: "6", label: "Saturday" },
  { iso: "7", label: "Sunday" },
];

/** ISO weekday ("1".."7") for a "YYYY-MM-DD" date (timezone-independent). */
export function isoWeekday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  return String(d === 0 ? 7 : d);
}

/** Allowed start-time slots ("HH:MM") for a date, given opening hours. */
export function slotsForDate(
  oh: OpeningHours | null | undefined,
  dateStr: string,
  stepMin = 15
): string[] {
  if (!oh || !dateStr) return [];
  const day = oh[isoWeekday(dateStr)];
  if (!day?.open || !day?.close) return [];
  const [oH, oM] = day.open.split(":").map(Number);
  const [cH, cM] = day.close.split(":").map(Number);
  const end = cH * 60 + cM;
  const out: string[] = [];
  for (let t = oH * 60 + oM; t < end; t += stepMin) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}

/** True if a date + "HH:MM" falls within opening hours (allows when unset). */
export function isWithinOpeningHours(
  oh: OpeningHours | null | undefined,
  dateStr: string,
  time: string
): boolean {
  if (!oh || Object.keys(oh).length === 0) return true; // not configured → allow
  const day = oh[isoWeekday(dateStr)];
  if (!day?.open || !day?.close) return false;
  return time >= day.open && time < day.close;
}

/** Whether any day is configured as open. */
export function hasOpeningHours(oh: OpeningHours | null | undefined): boolean {
  return !!oh && Object.values(oh).some((d) => d?.open && d?.close);
}
