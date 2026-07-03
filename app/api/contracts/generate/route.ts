import { NextRequest, NextResponse } from "next/server";
import { requireCompany, requireUser } from "@/modules/auth/queries";
import { generateContractDraft } from "@/lib/ai/generate-contract";
import { generatePolicyDraft } from "@/lib/ai/generate-policy";
import { generateJobDescriptionDraft } from "@/lib/ai/generate-job-description";
import { recordUsage } from "@/lib/billing/usage";

// AI generation of a full contract/policy can take 60-90s — give the function
// plenty of room (Vercel Pro allows up to 300s).
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { kind, name, brief, companyId, store } = (await req.json()) as {
      kind?: string;
      name?: string;
      brief?: string;
      companyId?: string;
      store?: boolean;
    };

    // Founders (platform admins) can generate: (a) File Store templates they'll
    // sell — no company, so nothing is billed; or (b) for a company they're
    // setting up. Otherwise the caller must be that company's own admin.
    const { profile } = await requireUser();
    let billCompanyId: string | null = null;
    if (profile?.is_platform_admin && store) {
      billCompanyId = null; // founder-authored store content isn't billable
    } else if (profile?.is_platform_admin && companyId) {
      billCompanyId = companyId;
    } else {
      const { current } = await requireCompany();
      if (current.role !== "admin") {
        return NextResponse.json({ error: "Only admins can generate documents." }, { status: 403 });
      }
      billCompanyId = current.company_id;
    }

    const text =
      kind === "policy"
        ? await generatePolicyDraft(name ?? "", brief ?? "")
        : kind === "job_description"
          ? await generateJobDescriptionDraft(name ?? "", brief ?? "")
          : await generateContractDraft(brief ?? "");

    const label = kind === "policy" ? "Policy" : kind === "job_description" ? "Job description" : "Contract";
    if (billCompanyId) {
      await recordUsage(billCompanyId, "ai", 1, { label, actorId: profile?.id ?? null });
    }

    return NextResponse.json({ text });
  } catch (e) {
    console.error("Document generation route failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate the document." },
      { status: 500 }
    );
  }
}
