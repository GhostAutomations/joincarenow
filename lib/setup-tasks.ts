// Shared metadata for the founder setup tasks — used both by the founder wizard
// (to know labels) and the admin dashboard checklist (to render tasks the
// founder "passed" to the admin to finish).

export const SETUP_TASK_META: Record<string, { label: string; hint: string; href: string }> = {
  branding: { label: "Add your logo and brand colours", hint: "Make the platform and emails look like yours.", href: "/settings" },
  branches: { label: "Set up your branches", hint: "Add the branches/locations you recruit for.", href: "/settings?s=branches" },
  roles: { label: "Set up your roles", hint: "Define the roles you hire for.", href: "/settings?s=roles" },
  workflows: { label: "Set up your onboarding workflow", hint: "Choose the tasks new starters complete.", href: "/onboarding-board" },
  contracts: { label: "Add your contract templates", hint: "Contracts applicants sign when they accept an offer.", href: "/settings?s=contracts" },
  policies: { label: "Add your policy documents", hint: "Handbook, GDPR, code of conduct, etc.", href: "/settings?s=contracts" },
  jobdescriptions: { label: "Add your job descriptions", hint: "Reusable descriptions for your job ads.", href: "/settings?s=jobdescriptions" },
  numbers: { label: "Set your employee numbering", hint: "How each new hire's Employee ID is set.", href: "/settings?s=numbers" },
  interview: { label: "Set your interview address", hint: "Your default address for in-person interviews.", href: "/settings?s=interview" },
  hours: { label: "Set your opening hours", hint: "Days/hours your office is open (constrains interviews).", href: "/settings?s=hours" },
  communication: { label: "Set communication preferences", hint: "Automated reminders — on/off and channel.", href: "/settings?s=communication" },
};
