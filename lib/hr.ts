// Employment types (captured in recruitment) and leaver reasons (CQC/CIW-aware).

export const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "student_20", label: "Student – 20 hours" },
];
export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  EMPLOYMENT_TYPES.map((t) => [t.value, t.label])
);

export const LEAVING_REASONS: string[] = [
  // Core HR
  "Resignation",
  "End of fixed-term contract",
  "Retirement",
  "Dismissal",
  "Redundancy",
  "Failed probation",
  "Left during/after onboarding",
  // Care-sector
  "Left the care sector",
  "Relocation",
  "Health reasons",
  "Career change",
  "Better pay/role elsewhere",
  // Sensitive
  "Deceased",
  "Mutual agreement",
  "TUPE transfer",
];
