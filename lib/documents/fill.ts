// Fill a contract/policy/JD template for a standalone (no-applicant) PDF so no
// unresolved placeholders remain. Handles BOTH {{merge_fields}} and the plain
// [bracket] placeholders used in authored document bodies (e.g. "Approved By:
// [Name / Job Title]"). Company "Document details" values fill the shared fields;
// person/offer fields become clear labels; genuinely optional brackets are left.

export type DocumentDetails = {
  policyOwner: string;   // Policy owner name / job title
  approvedBy: string;    // Approver name / job title
  hrContactName: string; // People/HR contact name
  hrContactEmail: string;
  approvalDate: string;  // ISO (yyyy-mm-dd) or ""
  reviewDate: string;    // ISO or ""
};

export const EMPTY_DOCUMENT_DETAILS: DocumentDetails = {
  policyOwner: "",
  approvedBy: "",
  hrContactName: "",
  hrContactEmail: "",
  approvalDate: "",
  reviewDate: "",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/** Read Document details from companies.settings.document_details. */
export function readDocumentDetails(settings: unknown): DocumentDetails {
  const d = (settings as { document_details?: Record<string, unknown> } | null)?.document_details ?? {};
  return {
    policyOwner: str(d.policyOwner),
    approvedBy: str(d.approvedBy),
    hrContactName: str(d.hrContactName),
    hrContactEmail: str(d.hrContactEmail),
    approvalDate: str(d.approvalDate),
    reviewDate: str(d.reviewDate),
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
    date: today,
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
    // Person/offer fields have no value on a blank template — show a clear label.
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
    if (key in tokens && tokens[key]) return tokens[key];
    if (key in tokens) return tokens[key]; // known but empty -> keep (may be "")
    const words = key.replace(/[._]+/g, " ").trim();
    return `[${words.charAt(0).toUpperCase()}${words.slice(1)}]`;
  });

  // 2) [bracket] placeholders, using the label before them on the same line when
  //    present (e.g. "Policy Owner: [Name / Job Title]"), else the bracket text.
  const lineFill = (label: string, inner: string): string | null => {
    const l = `${label} ${inner}`.toLowerCase();
    if (/review date|next review/.test(l) && review) return review;
    if (/(approval date|date approved|date issued)/.test(l) && approval) return approval;
    if (/policy owner/.test(l) && details.policyOwner) return details.policyOwner;
    if (/approved by/.test(l) && details.approvedBy) return details.approvedBy;
    if (/(hr|people)/.test(l) && (details.hrContactName || details.hrContactEmail)) {
      return hrContact(details, /email/.test(l));
    }
    // "Date Issued: [Date]" or a lone "[Date]" after a date-ish label.
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
      // Inline brackets anywhere on the line (HR/people, policy owner).
      return line.replace(/\[([^\]]+)\]/g, (whole, inner: string) => {
        const v = lineFill("", inner);
        return v ?? whole;
      });
    })
    .join("\n");

  return out;
}
