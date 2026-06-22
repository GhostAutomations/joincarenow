import { NextRequest, NextResponse } from "next/server";
import { requireCompany } from "@/modules/auth/queries";
import { generateContractDraft } from "@/lib/ai/generate-contract";
import { generatePolicyDraft } from "@/lib/ai/generate-policy";
import { recordUsage } from "@/lib/billing/usage";

// AI generation of a full contract/policy can take 60-90s — give the function
// plenty of room (Vercel Pro allows up to 300s).
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { current } = await requireCompany();
    if (current.role !== "admin") {
      return NextResponse.json({ error: "Only admins can generate documents." }, { status: 403 });
    }
    const { kind, name, brief } = (await req.json()) as {
      kind?: string;
      name?: string;
      brief?: string;
    };

    const text =
      kind === "policy"
        ? await generatePolicyDraft(name ?? "", brief ?? "")
        : await generateContractDraft(brief ?? "");

    await recordUsage(current.company_id, "ai");

    return NextResponse.json({ text });
  } catch (e) {
    console.error("Document generation route failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not generate the document." },
      { status: 500 }
    );
  }
}
