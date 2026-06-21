import { CrmGuide } from "@/components/dashboard/crm-guide";

// Sales (Prospect CRM) only — a guide sidebar with per-stage instructions sits
// alongside every CRM page. Scoped to /admin/sales/** so it appears nowhere else.
export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-6">
      <CrmGuide />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
