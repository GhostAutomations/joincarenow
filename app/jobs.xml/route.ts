import { createAdminClient } from "@/lib/supabase/admin";
import { descriptionToHtml } from "@/lib/seo/job-posting";

// Public XML job feed for aggregators (Adzuna, Jooble, Talent.com). Indeed-style
// <source><job>…</job></source> format, which those boards accept. Register this
// URL (https://www.joincarenow.com/jobs.xml) with each aggregator. Rebuilt hourly.
export const revalidate = 3600;

const SITE = "https://www.joincarenow.com";

type FeedRow = {
  company_name: string | null;
  company_slug: string;
  job_slug: string;
  job_id: string;
  title: string;
  description: string | null;
  employment_type: string | null;
  salary: string | null;
  city: string | null;
  region: string | null;
  postcode: string | null;
  created_at: string;
};

/** Wrap a value in CDATA, escaping any nested terminator. */
function cdata(v: string | null | undefined): string {
  return `<![CDATA[${(v ?? "").replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

/** Map our free-text employment type to the aggregator jobtype vocabulary. */
function feedJobType(raw: string | null): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("full")) return "fulltime";
  if (s.includes("part")) return "parttime";
  if (s.includes("contract")) return "contract";
  if (s.includes("temp") || s.includes("fixed") || s.includes("bank") || s.includes("casual") || s.includes("zero")) return "temporary";
  if (s.includes("apprentic") || s.includes("intern")) return "internship";
  return "";
}

/** Present the stored salary (often a bare number like "12.75") sensibly. */
function feedSalary(raw: string | null): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  return /^\d/.test(s) ? `£${s}` : s;
}

export async function GET() {
  let rows: FeedRow[] = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_public_jobs_feed");
    rows = (data ?? []) as FeedRow[];
  } catch {
    /* still return a valid, empty feed on a DB hiccup */
  }

  const jobs = rows
    .map((j) => {
      const url = `${SITE}/careers/${j.company_slug}/${j.job_slug}`;
      const jobType = feedJobType(j.employment_type);
      const salary = feedSalary(j.salary);
      return [
        "  <job>",
        `    <title>${cdata(j.title)}</title>`,
        `    <date>${cdata(new Date(j.created_at).toUTCString())}</date>`,
        `    <referencenumber>${cdata(j.job_id)}</referencenumber>`,
        `    <url>${cdata(url)}</url>`,
        `    <company>${cdata(j.company_name)}</company>`,
        `    <city>${cdata(j.city)}</city>`,
        `    <state>${cdata(j.region)}</state>`,
        `    <postalcode>${cdata(j.postcode)}</postalcode>`,
        `    <country>${cdata("GB")}</country>`,
        `    <description>${cdata(descriptionToHtml(j.description))}</description>`,
        salary ? `    <salary>${cdata(salary)}</salary>` : "",
        jobType ? `    <jobtype>${cdata(jobType)}</jobtype>` : "",
        `    <category>${cdata("Healthcare & Social Care")}</category>`,
        "  </job>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<source>
  <publisher>Join Care Now</publisher>
  <publisherurl>${SITE}</publisherurl>
  <lastBuildDate>${cdata(new Date().toUTCString())}</lastBuildDate>
${jobs}
</source>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
