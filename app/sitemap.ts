import type { MetadataRoute } from "next";
import { createAdminClient } from "@/lib/supabase/admin";

const SITE = "https://www.joincarenow.com";

// Re-generate hourly so newly published / expired jobs flow into the sitemap.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let jobs: { company_slug: string; job_slug: string; last_modified: string }[] = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin.rpc("get_public_job_urls");
    jobs = (data ?? []) as typeof jobs;
  } catch {
    /* sitemap should still return the static pages if the DB call fails */
  }

  const jobUrls: MetadataRoute.Sitemap = jobs.map((j) => ({
    url: `${SITE}/careers/${j.company_slug}/${j.job_slug}`,
    lastModified: j.last_modified ? new Date(j.last_modified) : new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // One entry per company that currently has open roles.
  const companySlugs = Array.from(new Set(jobs.map((j) => j.company_slug)));
  const careerUrls: MetadataRoute.Sitemap = companySlugs.map((slug) => ({
    url: `${SITE}/careers/${slug}`,
    changeFrequency: "daily",
    priority: 0.6,
  }));

  const marketingUrls: MetadataRoute.Sitemap = [
    "/features",
    "/pricing",
    "/guides",
    "/guides/cqc-regulation-19-safe-recruitment",
    "/guides/ciw-safe-recruitment-wales",
  ].map((path) => ({
    url: `${SITE}${path}`,
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  return [
    { url: SITE, changeFrequency: "weekly", priority: 1 },
    ...marketingUrls,
    ...careerUrls,
    ...jobUrls,
  ];
}
