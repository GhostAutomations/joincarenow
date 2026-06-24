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

  // Subscription-agreement gate: a real customer admin must e-sign before the
  // dashboard unlocks. Founder / "managing as" and non-admins are not gated.
  if (!acting && !profile?.is_platform_admin && current.role === "admin") {
    const { data: signed } = await supabase
      .from("company_agreements").select("id").eq("company_id", current.company_id).limit(1);
    if (!signed || signed.length === 0) redirect("/agreement");
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
