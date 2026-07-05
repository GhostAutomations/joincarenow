// Build schema.org JobPosting structured data (JSON-LD) for Google for Jobs.
// Populated entirely from a job's real, tenant-specific data. The hiring
// organisation is the care company — never Join Care Now.

const SITE = "https://www.joincarenow.com";

/** Map our free-text employment type to Google's JobPosting enum. */
export function mapEmploymentType(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("full")) return "FULL_TIME";
  if (s.includes("part")) return "PART_TIME";
  if (s.includes("bank") || s.includes("casual") || s.includes("zero")) return "PER_DIEM";
  if (s.includes("fixed") || s.includes("temp")) return "TEMPORARY";
  if (s.includes("contract")) return "CONTRACTOR";
  if (s.includes("apprentic") || s.includes("intern")) return "INTERN";
  if (s.includes("volunt")) return "VOLUNTEER";
  return "OTHER";
}

type Money = {
  "@type": "MonetaryAmount";
  currency: "GBP";
  value: Record<string, unknown>;
};

/** Parse a free-text UK salary into a schema.org MonetaryAmount. Returns
 *  undefined (omit cleanly) when no amount or no recognisable unit is found. */
export function parseSalary(raw: string | null | undefined): Money | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();

  let unitText: string | undefined;
  if (/(per\s*hour|\/\s*hour|\bp\/?h\b|\bhr\b|hourly)/.test(s)) unitText = "HOUR";
  else if (/(per\s*year|per\s*annum|\bp\.?a\.?\b|annual|\/\s*year|\byr\b)/.test(s)) unitText = "YEAR";
  else if (/(per\s*month|monthly|\/\s*month|\bpcm\b)/.test(s)) unitText = "MONTH";
  else if (/(per\s*week|weekly|\/\s*week)/.test(s)) unitText = "WEEK";
  else if (/(per\s*day|daily|\/\s*day)/.test(s)) unitText = "DAY";

  // Pull the monetary figures (strip thousands separators).
  const nums = (s.match(/£?\s*\d[\d,]*(?:\.\d+)?/g) ?? [])
    .map((m) => parseFloat(m.replace(/[£,\s]/g, "")))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return undefined;

  // Care adverts often omit the period (e.g. "£12.75"). Infer it from the size:
  // small amounts are hourly, large amounts are annual. A genuinely ambiguous
  // mid-range is left unset rather than guessed, so we never publish a wrong unit.
  if (!unitText) {
    const maxNum = Math.max(...nums);
    const minNum = Math.min(...nums);
    if (maxNum <= 100) unitText = "HOUR";
    else if (minNum >= 1000) unitText = "YEAR";
    else return undefined;
  }

  const value: Record<string, unknown> = { "@type": "QuantitativeValue", unitText };
  if (nums.length >= 2) {
    value.minValue = Math.min(nums[0], nums[1]);
    value.maxValue = Math.max(nums[0], nums[1]);
  } else {
    value.value = nums[0];
  }
  return { "@type": "MonetaryAmount", currency: "GBP", value };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Turn a plain-text description into simple HTML (Google prefers HTML). */
export function descriptionToHtml(text: string | null | undefined): string {
  const t = (text ?? "").trim();
  if (!t) return "<p></p>";
  return t
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

export type JobPostingInput = {
  title: string;
  description: string | null;
  datePostedISO: string; // ISO 8601
  validThroughISO: string; // ISO 8601 (always set)
  companyName: string;
  companySlug: string;
  logoUrl: string | null;
  location: string | null;
  employmentType: string | null;
  salary: string | null;
  jobId: string;
  companySlugForUrl: string;
  jobSlug: string;
};

/** Build the JobPosting JSON-LD object from a job's real data. */
export function buildJobPostingJsonLd(input: JobPostingInput): Record<string, unknown> {
  const careersUrl = `${SITE}/careers/${input.companySlug}`;
  const jobUrl = `${SITE}/careers/${input.companySlugForUrl}/${input.jobSlug}`;

  const org: Record<string, unknown> = {
    "@type": "Organization",
    name: input.companyName,
    sameAs: careersUrl,
  };
  if (input.logoUrl) org.logo = input.logoUrl;

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: input.title,
    description: descriptionToHtml(input.description),
    datePosted: input.datePostedISO,
    validThrough: input.validThroughISO,
    employmentType: mapEmploymentType(input.employmentType),
    hiringOrganization: org,
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(input.location ? { addressLocality: input.location } : {}),
        addressCountry: "GB",
      },
    },
    identifier: {
      "@type": "PropertyValue",
      name: input.companyName,
      value: input.jobId,
    },
    directApply: true,
    url: jobUrl,
  };

  if (!ld.employmentType) delete ld.employmentType;

  const salary = parseSalary(input.salary);
  if (salary) ld.baseSalary = salary;

  return ld;
}

/** validThrough: the explicit closing date, else posted + 30 days. */
export function computeValidThrough(closingDate: string | null, createdAtISO: string): string {
  if (closingDate) {
    // closing_date is a date (YYYY-MM-DD); treat end-of-day.
    return new Date(`${closingDate}T23:59:59Z`).toISOString();
  }
  const d = new Date(createdAtISO);
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}
