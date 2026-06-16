// Interview times are entered and shown in UK time. The picker emits a naive
// "YYYY-MM-DDTHH:MM" wall-clock string, which we must interpret as Europe/London
// (handling BST/GMT) when storing, and always format back in Europe/London.

const TZ = "Europe/London";

/** Offset (ms) between Europe/London and UTC at a given instant. */
function londonOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUTC = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return asUTC - instant;
}

/** Convert a London wall-clock string ("YYYY-MM-DDTHH:MM") to a UTC ISO instant.
 *  If the input already carries a timezone (Z or ±HH:MM), it's used as-is. */
export function londonToUtcIso(local: string): string {
  if (/[zZ]|[+-]\d\d:?\d\d$/.test(local)) return new Date(local).toISOString();
  const [d, t = "00:00"] = local.split("T");
  const [y, mo, da] = d.split("-").map(Number);
  const [hh, mi] = t.split(":").map(Number);
  const wall = Date.UTC(y, mo - 1, da, hh, mi);
  return new Date(wall - londonOffsetMs(wall)).toISOString();
}

/** Format an ISO instant in UK time. */
export function formatLondon(
  iso: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" }
): string {
  return new Date(iso).toLocaleString("en-GB", { ...opts, timeZone: TZ });
}
