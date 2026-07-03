// File Store categories for contracts / policies / job descriptions. Plain
// (non-client) module so server components can use it during render.

export const DOC_CATEGORIES: { value: string; label: string }[] = [
  { value: "care", label: "Care" },
  { value: "office", label: "Office & admin" },
  { value: "clinical", label: "Clinical" },
  { value: "compliance", label: "Compliance" },
  { value: "hr", label: "HR" },
  { value: "general", label: "General" },
];

const LABEL: Record<string, string> = Object.fromEntries(
  DOC_CATEGORIES.map((c) => [c.value, c.label])
);

export function docCategoryLabel(key: string): string {
  return LABEL[key] ?? (key ? key.charAt(0).toUpperCase() + key.slice(1) : "General");
}

const ORDER = DOC_CATEGORIES.map((c) => c.value);

export function sortDocCategories(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = ORDER.indexOf(a);
    const ib = ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}
