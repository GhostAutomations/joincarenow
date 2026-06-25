// Company role labels + the roles a company admin can assign to teammates.
// Levels 3/4/5 (registered_individual, manager, recruiter) share identical
// permissions — operational access only, no billing/settings/team management.
// 'admin' is the company owner (billing + settings + team), invited by the founder.

export type CompanyRole = "admin" | "registered_individual" | "manager" | "recruiter";

export const COMPANY_ROLE_LABEL: Record<string, string> = {
  admin: "Administrator",
  registered_individual: "Registered Individual",
  manager: "Registered Manager",
  recruiter: "Recruiter",
};

/** Roles a company admin can invite. (Admins are invited by the founder.) */
export const INVITE_ROLES: { value: CompanyRole; label: string }[] = [
  { value: "registered_individual", label: "Registered Individual" },
  { value: "manager", label: "Registered Manager" },
  { value: "recruiter", label: "Recruiter" },
];

/** Only the company admin can reach billing, settings and team management. */
export function isCompanyAdmin(role: string | undefined): boolean {
  return role === "admin";
}
