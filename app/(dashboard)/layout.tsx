import { requireCompany } from "@/modules/auth/queries";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, current } = await requireCompany();

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-teal-50">
      <Sidebar companyName={current.companies.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={profile?.full_name || profile?.email || ""} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
