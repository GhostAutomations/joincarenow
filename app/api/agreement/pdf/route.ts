import { NextRequest, NextResponse } from "next/server";
import { requireCompany, requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAgreementPdf } from "@/lib/agreements/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLAN_LABEL: Record<string, string> = {
  monthly: "12 Month + Setup",
  commit: "12 Month Fixed",
  annual: "Annual",
  diamond: "Diamond (usage only)",
};

/** Download the signed subscription agreement as a PDF. A company admin gets
 *  their own; a platform admin (founder) can pass ?company=<id> for any. */
export async function GET(req: NextRequest) {
  const companyParam = req.nextUrl.searchParams.get("company");

  let companyId: string;
  // Use the service-role client to read company_agreements regardless of who's
  // asking, AFTER we've authorised the caller for that company.
  const db = createAdminClient();

  if (companyParam) {
    await requirePlatformAdmin(); // founder only
    companyId = companyParam;
  } else {
    const { current } = await requireCompany({ allowSetup: true });
    companyId = current.company_id;
  }

  const [{ data: agreement }, { data: company }] = await Promise.all([
    db.from("company_agreements")
      .select("plan, offer, terms_snapshot, signer_name, signer_email, agreed_at")
      .eq("company_id", companyId)
      .order("agreed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("companies").select("name").eq("id", companyId).single(),
  ]);

  if (!agreement) {
    return NextResponse.json({ error: "No signed agreement on file for this company." }, { status: 404 });
  }

  const pdf = buildAgreementPdf({
    title: "Join Care Now — Subscription Agreement",
    bodyText: (agreement.terms_snapshot as string) ?? "",
    companyName: (company?.name as string) ?? "Customer",
    planLabel: PLAN_LABEL[(agreement.plan as string) ?? ""] ?? "Subscription",
    offer: (agreement.offer as string) ?? null,
    signerName: (agreement.signer_name as string) ?? "",
    signerEmail: (agreement.signer_email as string) ?? null,
    signedAt: (agreement.agreed_at as string) ?? new Date().toISOString(),
  });

  const safeName = ((company?.name as string) ?? "agreement").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="join-care-now-agreement-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
