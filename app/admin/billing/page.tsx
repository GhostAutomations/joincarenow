import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIER_LABEL } from "@/modules/forms/tiers";

export default async function AdminBillingPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const { data: companies } = await db
    .from("companies")
    .select("id, name, subscription_tier, created_at")
    .order("name");

  const rows = (companies ?? []) as { id: string; name: string; subscription_tier: string | null; created_at: string }[];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Billing</h1>
      <p className="mt-1 text-sm text-white/80">
        Plans across all companies. Payments, invoices and automated billing are coming soon.
      </p>

      <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-400/15 px-4 py-2.5 text-sm text-amber-100">
        Billing is in preview — this shows each company&apos;s current plan. Charging will be wired up when billing goes live.
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Since</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                    {TIER_LABEL[(c.subscription_tier as keyof typeof TIER_LABEL) ?? "free"] ?? c.subscription_tier ?? "Free"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500">{new Date(c.created_at).toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">No companies yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
