// Fill a contract/policy/JD template for a standalone (no-applicant) PDF so no
// unresolved placeholders remain. Handles BOTH {{merge_fields}} and the plain
// [bracket] placeholders used in authored document bodies (e.g. "Approved By:
// [Name / Job Title]").
//
// Two sources feed the fill:
//  - Company DEFAULTS (set once in Settings): policy owner, approver, HR contact.
//    These auto-fill every document so you don't re-enter them each time.
//  - Per-document DATES, derived from when the document was last saved:
//    approval date = last saved date; review date = that + the review period.

export type DocDefaults = {
  policyOwner: string;   // Policy owner name / job title
  approvedBy: string;    // Approver name / job title
  hrContactName: string; // People/HR contact name
  hrContactEmail: string;
  reviewMonths: number;  // how far ahead the review date sits (default 24)
};

export const EMPTY_DOC_DEFAULTS: DocDefaults = {
  policyOwner: "",
  approvedBy: "",
  hrContactName: "",
  hrContactEmail: "",
  reviewMonths: 24,
};

/** The resolved values used to fill a specific document (dates already derived). */
export type DocumentDetails = {
  policyOwner: string;
  approvedBy: string;
  hrContactName: string;
  hrContactEmail: string;
  approvalDate: string; // ISO
  reviewDate: string;   // ISO
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Read company document defaults from companies.settings.document_details. */
export function readDocDefaults(settings: unknown): DocDefaults {
  const d = (settings as { document_details?: Record<string, unknown> } | null)?.document_details ?? {};
  const months = Number(d.reviewMonths);
  return {
    policyOwner: str(d.policyOwner),
    approvedBy: str(d.approvedBy),
    hrContactName: str(d.hrContactName),
    hrContactEmail: str(d.hrContactEmail),
    reviewMonths: Number.isFinite(months) && months > 0 ? Math.min(120, Math.round(months)) : 24,
  };
}

function addMonthsIso(iso: string, months: number): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

/** Combine company defaults with a document's last-saved date to derive the
 *  approval date (that date) and review date (+ review period). */
export function deriveDocumentDetails(defaults: DocDefaults, lastSavedIso: string): DocumentDetails {
  return {
    policyOwner: defaults.policyOwner,
    approvedBy: defaults.approvedBy,
    hrContactName: defaults.hrContactName,
    hrContactEmail: defaults.hrContactEmail,
    approvalDate: lastSavedIso || "",
    reviewDate: lastSavedIso ? addMonthsIso(lastSavedIso, defaults.reviewMonths) : "",
  };
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** People/HR contact rendered as "Name (email)" / "Name" / "email". */
function hrContact(d: DocumentDetails, withEmail: boolean): string {
  const name = d.hrContactName.trim();
  const email = d.hrContactEmail.trim();
  if (withEmail && name && email) return `${name} (${email})`;
  if (withEmail && email && !name) return email;
  return name;
}

export function fillDocument(body: string, opts: { companyName: string; details: DocumentDetails }): string {
  const { companyName, details } = opts;
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const approval = fmtDate(details.approvalDate);
  const review = fmtDate(details.reviewDate);

  // 1) {{merge_field}} tokens.
  const tokens: Record<string, string> = {
    company_name: companyName,
    company: companyName,
    date: approval || today,
    today,
    policy_owner: details.policyOwner,
    approved_by: details.approvedBy,
    approver: details.approvedBy,
    hr_contact: hrContact(details, false),
    hr_email: details.hrContactEmail,
    approval_date: approval,
    date_approved: approval,
    review_date: review,
    next_review: review,
    first_name: "[First name]",
    last_name: "[Last name]",
    name: "[Full name]",
    full_name: "[Full name]",
    role: "[Role]",
    job_title: "[Role]",
    pay: "[Pay]",
    salary: "[Pay]",
    hours: "[Hours]",
    start_date: "[Start date]",
  };
  let out = (body || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, raw: string) => {
    const key = String(raw).toLowerCase().trim();
    if (key in tokens) return tokens[key];
    const words = key.replace(/[._]+/g, " ").trim();
    return `[${words.charAt(0).toUpperCase()}${words.slice(1)}]`;
  });

  // 2) [bracket] placeholders, using the label before them when present.
  const lineFill = (label: string, inner: string): string | null => {
    const l = `${label} ${inner}`.toLowerCase();
    if (/review date|next review/.test(l) && review) return review;
    if (/(approval date|date approved|date issued)/.test(l) && approval) return approval;
    if (/policy owner/.test(l) && details.policyOwner) return details.policyOwner;
    if (/approved by/.test(l) && details.approvedBy) return details.approvedBy;
    if (/(hr|people)/.test(l) && (details.hrContactName || details.hrContactEmail)) {
      return hrContact(details, /email/.test(l));
    }
    if (/\bdate\b/.test(label.toLowerCase()) && approval) return approval;
    return null;
  };

  out = out
    .split("\n")
    .map((line) => {
      const m = line.match(/^(\s*)([A-Za-z][A-Za-z .,&/'()-]*?):\s*\[([^\]]+)\]\s*$/);
      if (m) {
        const [, indent, label, inner] = m;
        const v = lineFill(label, inner);
        if (v) return `${indent}${label}: ${v}`;
      }
      return line.replace(/\[([^\]]+)\]/g, (whole, inner: string) => lineFill("", inner) ?? whole);
    })
    .join("\n");

  return out;
}
