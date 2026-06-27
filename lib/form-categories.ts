// Form category helpers — plain (non-client) module so server components can
// call them during render. The collapsible UI lives in a separate client file.

const CATEGORY_LABEL: Record<string, string> = {
  application: "Application forms",
  recruitment: "Recruitment",
  hr: "HR",
  onboarding: "Onboarding",
  referencing: "Referencing",
  other: "Other",
};

/** The canonical category order; unknown categories are appended. */
export const CATEGORY_ORDER = ["application", "recruitment", "onboarding", "referencing", "hr", "other"];

export function categoryLabel(key: string): string {
  return CATEGORY_LABEL[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

/** Sort a set of category keys into a sensible display order. */
export function sortCategories(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });
}
