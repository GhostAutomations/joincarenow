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
