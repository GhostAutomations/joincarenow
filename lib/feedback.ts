export const FEEDBACK_WINDOW_DAYS = 28;

/** True if the company is still within its 4-week feedback window. */
export function feedbackOpen(companyCreatedAt: string | null | undefined): boolean {
  if (!companyCreatedAt) return false;
  return Date.now() - new Date(companyCreatedAt).getTime() < FEEDBACK_WINDOW_DAYS * 86_400_000;
}
