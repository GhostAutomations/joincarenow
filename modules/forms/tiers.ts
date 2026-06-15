// Plain (non-"use server") module so these constants can be exported and
// imported by both server actions and client/UI components.

export const TIERS = ["free", "pro", "enterprise"];

export const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
};

export const tierRank = (t: string) => Math.max(0, TIERS.indexOf(t));
