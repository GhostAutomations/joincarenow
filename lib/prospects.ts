/** Flags content that must always have human approval (price/contract/compliance). */
export function detectHighRisk(text: string): boolean {
  return /\b(price|pricing|cost|quote|discount|contract|terms|sign\s*up|guarantee|warrant|complian|cqc|ciw)\b|[£$€]/i.test(text);
}

export const STAGES = ["new", "contacted", "engaged", "demo", "proposal", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const STAGE_LABEL: Record<Stage, string> = {
  new: "New",
  contacted: "Contacted",
  engaged: "Engaged",
  demo: "Demo booked",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};
