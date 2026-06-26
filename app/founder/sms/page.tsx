import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";

type Usage = {
  company_id: string;
  company_name: string;
  sms_this_month: number;
  sms_total: number;
};

export default async function SmsUsagePage() {
  const { supabase } = await requirePlatformAdmin();
  const { data } = await supabase.rpc("get_sms_usage");
  const rows = (data ?? []) as Usage[];

  const monthTotal = rows.reduce((s, r) => s + Number(r.sms_this_month), 0);
  const allTotal = rows.reduce((s, r) => s + Number(r.sms_total), 0);
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div>
      <Link href="/founder" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Founder console
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-white drop-shadow-sm">SMS usage</h1>
      <p className="mt-1 text-sm text-white/80">
        Outbound SMS by company — {monthName} and all‑time. Useful for setting per‑SMS pricing.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-4 shadow-sm">
          <p className="text-xs text-gray-500">This month</p>
          <p className="text-2xl font-semibold text-gray-900">{monthTotal.toLocaleString()}</p>
        </div>
        <div className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-4 shadow-sm">
          <p className="text-xs text-gray-500">All‑time</p>
          <p className="text-2xl font-semibold text-gray-900">{allTotal.toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3 text-right">This month</th>
              <th className="px-4 py-3 text-right">All‑time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500">No companies yet.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.company_id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.company_name}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{Number(r.sms_this_month).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(r.sms_total).toLocaleString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
