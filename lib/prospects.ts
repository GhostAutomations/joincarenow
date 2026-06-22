/** Flags content that must always have human approval (price/contract/compliance). */
export function detectHighRisk(text: string): boolean {
  return /\b(price|pricing|cost|quote|discount|contract|terms|sign\s*up|guarantee|warrant|complian|cqc|ciw)\b|[£$€]/i.test(text);
}

/**
 * CRM agent sending window: 08:00–18:00 Europe/London (DST-safe). The AI
 * reply agent and sequences only send inside this window — nothing goes out
 * between 18:01 and 07:59. 18:00 on the dot is still allowed.
 */
export function isWithinSendingWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const mins = hh * 60 + mm;
  return mins >= 8 * 60 && mins <= 18 * 60; // 08:00–18:00 inclusive
}

export const STAGES = ["new", "contacted", "engaged", "demo", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  new: "Contact ready",
  contacted: "Contacted",
  engaged: "Engaged",
  demo: "Demo booked",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
