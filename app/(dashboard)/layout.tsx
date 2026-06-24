import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { Dock } from "@/components/dashboard/dock";
import { BrandStyle, type Brand } from "@/components/dashboard/brand-style";
import { ActingBanner } from "@/components/dashboard/acting-banner";
import { feedbackOpen } from "@/lib/feedback";

type CompanySettings = {
  show_sidebar?: boolean;
  brand?: Brand & { logo_url?: string | null };
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireCompany();
  const { supabase, profile, current } = ctx;
  const acting = "acting" in ctx && ctx.acting === true;

  // Account-setup gates for a real customer admin (founder / "managing as" and
  // non-admins are never gated): 1) e-sign the subscription agreement, then
  // 2) pay to activate, before the dashboard unlocks.
  if (!acting && !profile?.is_platform_admin && current.role === "admin") {
    const [{ data: signed }, { data: billing }] = await Promise.all([
      supabase.from("company_agreements").select("id").eq("company_id", current.company_id).limit(1),
      supabase.from("companies").select("billing_status, billing_comped").eq("id", current.company_id).single(),
    ]);
    if (!signed || signed.length === 0) redirect("/agreement");
    const status = (billing?.billing_status as string) ?? "none";
    const active = billing?.billing_comped === true || status === "active" || status === "trialing";
    if (!active) redirect("/activate");
  }

  const { data: companyRow } = await supabase
    .from("companies").select("settings, created_at").eq("id", current.company_id).single();
  const settings = (companyRow?.settings as CompanySettings | null) ?? null;
  const fbOpen = feedbackOpen(companyRow?.created_at as string | undefined);
  const isAdmin = current.role === "admin";
  // Sidebar is OFF by default (iPad-style launcher); admins can switch it on.
  const showSidebar = settings?.show_sidebar === true;
  const brand = settings?.brand ?? null;
  const logoUrl = brand?.logo_url ?? null;

  return (
    <div className="flex h-screen overflow-hidden jcn-app-bg">
      <BrandStyle brand={brand} />
      {showSidebar && <Sidebar companyName={current.companies.name} logoUrl={logoUrl} />}
      <div className="flex flex-1 flex-col overflow-hidden">
        {acting && <ActingBanner companyName={current.companies.name} />}
        <Topbar
          userName={profile?.full_name || profile?.email || ""}
          showHome={!showSidebar}
          logoUrl={logoUrl}
        />
        <main className="flex-1 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">{children}</main>
      </div>
      {!showSidebar && <Dock feedbackOpen={fbOpen} isAdmin={isAdmin} />}
    </div>
  );
}
