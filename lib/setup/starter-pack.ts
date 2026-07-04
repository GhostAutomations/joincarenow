// ============================================================
// JOIN CARE NOW — Starter pack (single source of truth)
// The "full company setup" a new care company receives on day one so the
// platform is turnkey and the £150 setup fee is justified: ready-made forms,
// an onboarding workflow, branded email + SMS templates, a sample job and
// sensible communication defaults. Pure data — applied by lib/setup/seed.ts.
//
// Bump STARTER_PACK_VERSION whenever the content below changes so re-seeding
// can be reasoned about; the seed engine records it on companies.settings.
// ============================================================

export const STARTER_PACK_VERSION = 1;

// ---- Forms -------------------------------------------------
// field_type must be a value of public.form_field_type:
//   short_text | long_text | number | date | dropdown | radio | checkboxes
//   | yes_no | file | address | time | date_range | rating | country | link
export type StarterField = {
  label: string;
  field_type: string;
  required?: boolean;
  options?: string[];
  help_text?: string;
};

export type StarterForm = {
  key: string; // stable handle used to wire onboarding tasks + the sample job
  name: string;
  purpose: string; // 'application' | 'onboarding'
  category: string;
  description: string;
  fields: StarterField[];
};

export const STARTER_FORMS: StarterForm[] = [
  {
    key: "care_application",
    name: "Care Worker Application",
    purpose: "application",
    category: "application",
    description: "",
    fields: [
      { label: "First name", field_type: "short_text", required: true },
      { label: "Last name", field_type: "short_text", required: true },
      { label: "Email address", field_type: "short_text", required: true },
      { label: "Mobile number", field_type: "short_text", required: true },
      { label: "Home address", field_type: "address", required: true },
      {
        label: "Do you have the right to work in the UK?",
        field_type: "yes_no",
        required: true,
        help_text: "You'll be asked to provide proof if your application progresses.",
      },
      { label: "Do you hold a full UK driving licence?", field_type: "yes_no" },
      { label: "Do you have access to your own vehicle?", field_type: "yes_no" },
      {
        label: "Which shifts can you work?",
        field_type: "checkboxes",
        options: ["Weekday days", "Weekday evenings", "Weekends", "Nights", "Bank holidays"],
        required: true,
      },
      {
        label: "Tell us about your care experience",
        field_type: "long_text",
        help_text: "Paid or unpaid. If you're new to care, tell us why you'd like to start.",
      },
      {
        label: "Relevant qualifications (e.g. Care Certificate, NVQ/QCF)",
        field_type: "long_text",
      },
      { label: "Earliest start date", field_type: "date" },
      {
        label: "How did you hear about us?",
        field_type: "dropdown",
        options: ["Indeed", "Facebook", "Word of mouth", "Our website", "Other"],
      },
    ],
  },
];

// ---- Onboarding workflow -----------------------------------
// task_type must be one of: 'form' | 'document' | 'acknowledge'.
// formKey (for 'form' tasks) references a STARTER_FORMS key.
export type StarterOnboardingTask = {
  title: string;
  task_type: "form" | "document" | "acknowledge";
  formKey?: string;
  body?: string;
  required?: boolean;
  due_days?: number;
};

export const STARTER_ONBOARDING: StarterOnboardingTask[] = [
  {
    title: "Right to Work check",
    task_type: "document",
    body: "Upload proof of your right to work in the UK (passport, or share code + ID).",
    required: true,
    due_days: 0,
  },
  {
    title: "DBS certificate",
    task_type: "document",
    body: "Upload your current DBS certificate, or your DBS Update Service details.",
    required: true,
    due_days: 0,
  },
  {
    title: "Proof of address",
    task_type: "document",
    body: "Upload a recent utility bill, bank statement or council tax letter (within the last 3 months).",
    required: true,
    due_days: 3,
  },
  {
    title: "Upload your CV / employment history",
    task_type: "document",
    body: "Please provide a full 5-year history of employment with no gaps. Add a short note explaining any gaps.",
    required: true,
    due_days: 5,
  },
  {
    title: "Proof of qualifications",
    task_type: "document",
    body: "Upload certificates for any relevant qualifications (Care Certificate, NVQ/QCF, manual handling, etc.).",
    required: false,
    due_days: 7,
  },
  {
    title: "Uniform & PPE sizes",
    task_type: "acknowledge",
    body: "Confirm your uniform and footwear sizes with your manager so we can order your kit before day one.",
    required: false,
    due_days: 7,
  },
  {
    title: "Read & accept company policies",
    task_type: "acknowledge",
    body:
      "[PLACEHOLDER — replace with your own policy summary] Please confirm you have read and agree to follow our " +
      "policies, including safeguarding, health & safety, confidentiality (GDPR), medication and infection control.",
    required: true,
    due_days: 7,
  },
  {
    title: "Sign your contract of employment",
    task_type: "acknowledge",
    body: "Your contract of employment will be issued for signature separately. Confirm here once you've signed it.",
    required: true,
    due_days: 10,
  },
];

// ---- Message templates -------------------------------------
// Email bodies are deliberately link-free: the platform wraps every customer
// email in the branded layout and adds the CTA button (standing rule — no raw
// links in customer emails). Merge fields: {{first_name}}, {{company_name}},
// {{job_title}}, {{interview_date}}.
export type StarterTemplate = {
  channel: "email" | "sms";
  name: string;
  category: string;
  subject?: string; // email only
  body: string;
};

export const STARTER_TEMPLATES: StarterTemplate[] = [
  // ---- Email ----
  {
    channel: "email",
    name: "Application received",
    category: "Application",
    subject: "We've received your application — {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for applying for the {{job_title}} role with {{company_name}}. We've received your application and our team will review it shortly.\n\n" +
      "If we'd like to take things further, we'll be in touch to arrange the next step.\n\n" +
      "Kind regards,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Invitation to interview",
    category: "Interview",
    subject: "Invitation to interview — {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "Good news — we'd like to invite you to an interview for the {{job_title}} role with {{company_name}}.\n\n" +
      "Use the button below to confirm a time that works for you. If you have any access requirements, just let us know.\n\n" +
      "We look forward to meeting you.\n\n" +
      "Kind regards,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Interview reminder",
    category: "Interview",
    subject: "A reminder about your interview with {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "This is a friendly reminder about your interview for the {{job_title}} role with {{company_name}} on {{interview_date}}.\n\n" +
      "Please bring proof of your right to work in the UK. If you can no longer attend, let us know and we'll rearrange.\n\n" +
      "Kind regards,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Conditional offer",
    category: "Offer",
    subject: "A conditional offer from {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "We're delighted to offer you the {{job_title}} role with {{company_name}}, subject to satisfactory pre-employment checks (right to work, DBS and references).\n\n" +
      "Use the button below to review and accept your offer and start onboarding.\n\n" +
      "Welcome aboard,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Pre-employment checks requested",
    category: "Compliance",
    subject: "Next steps — your pre-employment checks with {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "To progress your {{job_title}} role with {{company_name}}, we now need to complete your pre-employment checks: your right to work, DBS and references.\n\n" +
      "Use the button below to upload your documents and add your referees in your portal.\n\n" +
      "Kind regards,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Welcome — onboarding starts",
    category: "Onboarding",
    subject: "Welcome to {{company_name}} — let's get you started",
    body:
      "Hi {{first_name}},\n\n" +
      "Welcome to the team at {{company_name}}! We're really pleased to have you joining us as {{job_title}}.\n\n" +
      "Use the button below to complete your onboarding tasks before your first day. If anything's unclear, just reply and we'll help.\n\n" +
      "See you soon,\n{{company_name}}",
  },
  {
    channel: "email",
    name: "Unsuccessful application",
    category: "Rejection",
    subject: "An update on your application — {{company_name}}",
    body:
      "Hi {{first_name}},\n\n" +
      "Thank you for your interest in the {{job_title}} role with {{company_name}} and for the time you gave to your application.\n\n" +
      "On this occasion we won't be taking things further, but we were grateful for the opportunity to consider you and we wish you the very best in your search.\n\n" +
      "With kind regards,\n{{company_name}}",
  },
  // ---- SMS (160-char minded, no links — portal/CTA handled in-platform) ----
  {
    channel: "sms",
    name: "Application received",
    category: "Application",
    body: "Hi {{first_name}}, thanks for applying to {{company_name}} for the {{job_title}} role. We'll review it and be in touch soon.",
  },
  {
    channel: "sms",
    name: "Interview invitation",
    category: "Interview",
    body: "Hi {{first_name}}, {{company_name}} would like to invite you to interview for the {{job_title}} role. Please check your email to confirm a time.",
  },
  {
    channel: "sms",
    name: "Interview reminder",
    category: "Interview",
    body: "Hi {{first_name}}, a reminder of your interview with {{company_name}} on {{interview_date}}. Please bring right-to-work proof. Reply to rearrange.",
  },
  {
    channel: "sms",
    name: "Offer made",
    category: "Offer",
    body: "Hi {{first_name}}, great news — {{company_name}} has made you an offer for the {{job_title}} role. Please check your email to review and accept.",
  },
  {
    channel: "sms",
    name: "Onboarding reminder",
    category: "Onboarding",
    body: "Hi {{first_name}}, a reminder to finish your onboarding tasks for {{company_name}} before your start date. Log in to your portal to complete them.",
  },
];

// ---- Default roles -----------------------------------------
// Seeded into the company's `roles` so workflows have something to target out of
// the box. The founder can edit/add more (incl. custom) in Settings → Roles.
// team: 'care' = branch/care-delivery roles · 'office' = head-office team.
export type StarterRole = { name: string; team: "care" | "office" };
export const DEFAULT_ROLES: StarterRole[] = [
  { name: "Carer", team: "care" },
  { name: "Senior Carer", team: "care" },
  { name: "Supervisor", team: "office" },
  { name: "Planner", team: "office" },
  { name: "Branch Manager", team: "office" },
  { name: "Registered Manager", team: "office" },
  { name: "Registered Individual", team: "office" },
];

// ---- Defaults applied to companies.settings ----------------
// Only set when the company hasn't already configured them (don't clobber
// branding the founder set up).
export const STARTER_CAREERS = {
  intro:
    "We're a care provider that puts the people we support — and our staff — first. " +
    "If you're caring, reliable and want a job that matters, we'd love to hear from you. " +
    "[Edit this introduction in Settings → Careers page.]",
  benefits: [
    "Full training and induction",
    "Flexible shifts",
    "Supportive team and management",
    "Clear progression in care",
  ],
};

// Reminder defaults mirror lib/comms/reminders.ts kinds + timings, written
// explicitly so the customer can see them switched on in Settings → Communication.
export const STARTER_REMINDERS: Record<
  string,
  { enabled: boolean; channel: "email" | "sms" | "both"; hoursBefore?: number; afterDays?: number; repeatDays?: number; daysBefore?: number }
> = {
  interview: { enabled: true, channel: "both", hoursBefore: 24 },
  docs: { enabled: true, channel: "both", afterDays: 3, repeatDays: 3 },
  onboarding: { enabled: true, channel: "both", daysBefore: 2 },
  start_date: { enabled: true, channel: "both", daysBefore: 1 },
};

// A neutral brand primary so branded emails look intentional before the
// company uploads their own. Only applied when no brand colour is set.
export const STARTER_BRAND_PRIMARY = "#081231"; // Join Care Now navy
