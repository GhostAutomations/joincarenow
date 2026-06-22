import type { SupabaseClient } from "@supabase/supabase-js";

export const DEFAULT_SEND_START_HOUR = 8; // 08:00
export const DEFAULT_SEND_END_HOUR = 18; // 18:00

export type SendWindow = { start: number; end: number };

function clampHour(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : fallback;
}

/**
 * Read the CRM agent sending window (hours, Europe/London) from
 * platform_settings. Defaults to 08:00–18:00 if unset.
 */
export async function getSendWindow(db: SupabaseClient): Promise<SendWindow> {
  const { data } = await db
    .from("platform_settings")
    .select("key, value")
    .in("key", ["prospect_send_start_hour", "prospect_send_end_hour"]);
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]));
  return {
    start: clampHour(map.get("prospect_send_start_hour"), DEFAULT_SEND_START_HOUR),
    end: clampHour(map.get("prospect_send_end_hour"), DEFAULT_SEND_END_HOUR),
  };
}

/**
 * True if `now` (evaluated in Europe/London, DST-safe) falls within the
 * sending window. The end hour is inclusive on the hour (e.g. end=18 allows
 * 18:00 but not 18:01).
 */
export function isWithinSendingWindow(
  startHour: number,
  endHour: number,
  now: Date = new Date()
): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hh * 60 + mm;
  return mins >= startHour * 60 && mins <= endHour * 60;
}
