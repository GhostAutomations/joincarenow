import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";

export default function BillingPage() {
  return (
    <div>
      <PageHeader title="Billing" subtitle="Manage your subscription and invoices." />
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white/70 p-10 text-center shadow-sm backdrop-blur">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white">
          <CreditCard className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-900">Billing is coming soon</h2>
        <p className="mt-1 text-sm text-gray-500">
          You&apos;re all set on your current plan. When billing goes live, you&apos;ll manage your
          subscription, payment method and invoices right here.
        </p>
      </div>
    </div>
  );
}
