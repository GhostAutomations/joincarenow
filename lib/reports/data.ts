import type { SupabaseClient } from "@supabase/supabase-js";

export const RANGES: Record<string, { label: string; days: number | null }> = {
  "30": { label: "30 days", days: 30 },
  "90": { label: "90 days", days: 90 },
  "365": { label: "12 months", days: 365 },
  all: { label: "All time", days: null },
};
export function rangeKeyOf(param?: string): string {
  return RANGES[param ?? "90"] ? (param ?? "90") : "90";
}
function cutoffIso(rangeKey: string): string | null {
  const days = RANGES[rangeKey].days;
  return days ? new Date(Date.now() - days * 86400e3).toISOString() : null;
}

export const FUNNEL = ["applied", "reviewing", "interview", "right_to_work", "offer", "hired"] as const;
export const STAGE_LABEL: Record<string, string> = {
  applied: "Applied",
  reviewing: "Reviewing",
  interview: "Interview",
  right_to_work: "Right to work",
  offer: "Offer",
  hired: "Hired",
  rejected: "Not progressing",
};

export type FunnelStep = { stage: string; label: string; count: number; pctOfMax: number; pctOfTotal: number };

function buildFunnel(byStage: Map<string, number>, total: number): FunnelStep[] {
  const max = Math.max(1, ...FUNNEL.map((s) => byStage.get(s) ?? 0));
  return FUNNEL.map((s) => {
    const count = byStage.get(s) ?? 0;
    return { stage: s, label: STAGE_LABEL[s], count, pctOfMax: Math.round((count / max) * 100), pctOfTotal: total ? Math.round((count / total) * 100) : 0 };
  });
}

// ---------- Company recruitment report ----------
export type RecruitmentReport = {
  rangeKey: string;
  rangeLabel: string;
  stats: { total: number; active: number; hired: number; rejected: number; conversion: number; avgTth: number | null };
  funnel: FunnelStep[];
  jobRows: { title: string; apps: number; hired: number; conv: number }[];
  branchRows: { name: string; apps: number; hired: number; conv: number }[];
};

export async function getRecruitmentReport(supabase: SupabaseClient, companyId: string, rangeKey: string): Promise<RecruitmentReport> {
  const cut = cutoffIso(rangeKey);
  let q = supabase.from("applications").select("stage, created_at, hired_at, job_id").eq("company_id", companyId);
  if (cut) q = q.gte("created_at", cut);
  const [{ data: apps }, { data: jobs }, { data: branches }] = await Promise.all([
    q,
    supabase.from("jobs").select("id, title, branch_id").eq("company_id", companyId),
    supabase.from("branches").select("id, name").eq("company_id", companyId),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (apps ?? []) as any[];
  const jobMap = new Map((jobs ?? []).map((j) => [j.id as string, { title: j.title as string, branchId: (j.branch_id as string) ?? null }]));
  const branchMap = new Map((branches ?? []).map((b) => [b.id as string, b.name as string]));

  const total = rows.length;
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  const hired = byStage.get("hired") ?? 0;
  const rejected = byStage.get("rejected") ?? 0;
  const tth = rows.filter((r) => r.stage === "hired" && r.hired_at).map((r) => (new Date(r.hired_at).getTime() - new Date(r.created_at).getTime()) / 86400e3).filter((d) => d >= 0);
  const avgTth = tth.length ? Math.round(tth.reduce((a, b) => a + b, 0) / tth.length) : null;

  const perJob = new Map<string, { title: string; apps: number; hired: number }>();
  const perBranch = new Map<string, { apps: number; hired: number }>();
  for (const r of rows) {
    const job = jobMap.get(r.job_id);
    const je = perJob.get(r.job_id) ?? { title: job?.title ?? "Unknown job", apps: 0, hired: 0 };
    je.apps += 1; if (r.stage === "hired") je.hired += 1; perJob.set(r.job_id, je);
    const bName = job?.branchId ? branchMap.get(job.branchId) ?? "Unassigned" : "Unassigned";
    const be = perBranch.get(bName) ?? { apps: 0, hired: 0 };
    be.apps += 1; if (r.stage === "hired") be.hired += 1; perBranch.set(bName, be);
  }
  const conv = (a: number, h: number) => (a ? Math.round((h / a) * 100) : 0);

  return {
    rangeKey,
    rangeLabel: RANGES[rangeKey].label,
    stats: { total, active: total - hired - rejected, hired, rejected, conversion: conv(total, hired), avgTth },
    funnel: buildFunnel(byStage, total),
    jobRows: [...perJob.values()].sort((a, b) => b.apps - a.apps).map((j) => ({ title: j.title, apps: j.apps, hired: j.hired, conv: conv(j.apps, j.hired) })),
    branchRows: [...perBranch.entries()].sort((a, b) => b[1].apps - a[1].apps).map(([name, b]) => ({ name, apps: b.apps, hired: b.hired, conv: conv(b.apps, b.hired) })),
  };
}

// ---------- Founder platform report ----------
export type PlatformReport = {
  rangeKey: string;
  rangeLabel: string;
  totals: { companies: number; apps: number; hired: number; live: number; msgs: number; conversion: number };
  funnel: FunnelStep[];
  companyRows: { id: string; name: string; billing: string; apps: number; active: number; hired: number; live: number; msgs: number; lastActive: string | null }[];
};

export async function getPlatformReport(db: SupabaseClient, rangeKey: string, monthStartIso: string): Promise<PlatformReport> {
  const cut = cutoffIso(rangeKey);
  let q = db.from("applications").select("company_id, stage, created_at");
  if (cut) q = q.gte("created_at", cut);
  const [{ data: companies }, { data: apps }, { data: jobs }, { data: msgs }] = await Promise.all([
    db.from("companies").select("id, name, billing_status, billing_comped, agreed_plan").order("name"),
    q,
    db.from("jobs").select("company_id, status"),
    db.from("messages").select("company_id, channel").eq("direction", "outbound").gte("created_at", monthStartIso),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (apps ?? []) as any[];
  const total = rows.length;
  const byStage = new Map<string, number>();
  for (const r of rows) byStage.set(r.stage, (byStage.get(r.stage) ?? 0) + 1);
  const hired = byStage.get("hired") ?? 0;

  type Agg = { apps: number; active: number; hired: number; live: number; msgs: number; lastActive: string | null };
  const agg = new Map<string, Agg>();
  const ensure = (id: string) => { let a = agg.get(id); if (!a) { a = { apps: 0, active: 0, hired: 0, live: 0, msgs: 0, lastActive: null }; agg.set(id, a); } return a; };
  for (const r of rows) {
    const a = ensure(r.company_id);
    a.apps += 1;
    if (r.stage === "hired") a.hired += 1; else if (r.stage !== "rejected") a.active += 1;
    if (!a.lastActive || r.created_at > a.lastActive) a.lastActive = r.created_at;
  }
  for (const j of jobs ?? []) if (j.status === "published") ensure(j.company_id as string).live += 1;
  for (const m of msgs ?? []) ensure(m.company_id as string).msgs += 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billingLabel = (c: any) => c.billing_comped === true ? "Comp" : c.agreed_plan === "diamond" ? "Diamond" : (c.billing_status === "active" || c.billing_status === "trialing") ? "Paying" : "—";
  const companyRows = (companies ?? []).map((c) => ({ id: c.id as string, name: c.name as string, billing: billingLabel(c), ...(agg.get(c.id as string) ?? { apps: 0, active: 0, hired: 0, live: 0, msgs: 0, lastActive: null }) }))
    .sort((a, b) => b.apps - a.apps);

  return {
    rangeKey,
    rangeLabel: RANGES[rangeKey].label,
    totals: {
      companies: companies?.length ?? 0, apps: total, hired,
      live: companyRows.reduce((s, r) => s + r.live, 0), msgs: companyRows.reduce((s, r) => s + r.msgs, 0),
      conversion: total ? Math.round((hired / total) * 100) : 0,
    },
    funnel: buildFunnel(byStage, total),
    companyRows,
  };
}

// ---------- Founder billing/revenue report ----------
export type BillingReport = {
  metrics: { mrr: number; arr: number; paying: number; onCommitment: number; pastDue: number; comped: number; monthly: number; annual: number; diamond: number };
  companyRows: { name: string; status: string; plan: string; branches: number; mrr: number }[];
};

export async function getBillingReport(db: SupabaseClient): Promise<BillingReport> {
  const { data } = await db.from("companies")
    .select("name, billing_status, billing_interval, commitment_until, extra_branches, billing_comped, agreed_plan").order("name");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  const now = new Date();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isPaying = (r: any) => (r.billing_status === "active" || r.billing_status === "trialing") && !r.billing_comped;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const committed = (r: any) => !!r.commitment_until && new Date(r.commitment_until) > now;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const diamond = (r: any) => r.agreed_plan === "diamond";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const planOf = (r: any) => r.billing_comped ? "Comp" : !isPaying(r) ? "—" : diamond(r) ? "Diamond" : r.billing_interval === "year" ? "Annual" : committed(r) ? "12-month" : "Monthly";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mrrOf = (r: any) => isPaying(r) && !diamond(r) ? (r.billing_interval === "year" ? 550 / 12 : 55) + (r.extra_branches ?? 0) * 7.5 : 0;

  const mrr = rows.reduce((s, r) => s + mrrOf(r), 0);
  return {
    metrics: {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      paying: rows.filter(isPaying).length,
      onCommitment: rows.filter((r) => isPaying(r) && committed(r)).length,
      pastDue: rows.filter((r) => r.billing_status === "past_due").length,
      comped: rows.filter((r) => r.billing_comped === true).length,
      monthly: rows.filter((r) => isPaying(r) && !diamond(r) && r.billing_interval !== "year" && !committed(r)).length,
      annual: rows.filter((r) => isPaying(r) && r.billing_interval === "year").length,
      diamond: rows.filter((r) => isPaying(r) && diamond(r)).length,
    },
    companyRows: rows.map((r) => ({
      name: r.name as string,
      status: (r.billing_comped ? "complimentary" : r.billing_status ?? "none") as string,
      plan: planOf(r),
      branches: 1 + (r.extra_branches ?? 0),
      mrr: Math.round(mrrOf(r) * 100) / 100,
    })),
  };
}
