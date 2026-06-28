import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip any leading £ + spaces (we store salary/pay as just the amount). */
export function stripPound(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/^£\s*/, "");
}

/** Display a salary/pay with exactly one leading £ (idempotent). Empty -> "". */
export function formatSalary(raw: string | null | undefined): string {
  const s = stripPound(raw);
  return s ? `£${s}` : "";
}

/** Strip a trailing "p"/"P" + spaces (mileage is stored as just the number). */
export function stripPence(raw: string | null | undefined): string {
  return (raw ?? "").trim().replace(/\s*p$/i, "").trim();
}

/** Display a mileage rate with a trailing "p" (idempotent). Empty -> "". */
export function formatMileage(raw: string | null | undefined): string {
  const s = stripPence(raw);
  return s ? `${s}p` : "";
}

/** "Acme Care Ltd" -> "acme-care-ltd" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
