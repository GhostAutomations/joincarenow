import Link from "next/link";
import { ArrowLeft, ShoppingBag } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { londonToUtcIso } from "@/lib/time";

type Cell = { count: number; pence: number };
type Row = { name: string; type: string; mtd: Cell; qtd: Cell; ytd: Cell };

const blank = (): Cell => ({ count: 0, pence: 0 });
const gbp = (pence: number) => "£" + (pence / 100).toFixed(2);

// Each sellable type: its purchase table + the store table its names come from.
const SOURCES = [
  { type: "Form", purchases: "form_purchases", store: "forms", storeCol: "store_form_id" },
  { type: "Contract", purchases: "contract_purchases", store: "contract_templates", storeCol: "store_id" },
  { type: "Policy", purchases: "policy_purchases", store: "policy_documents", storeCol: "store_id" },
  { type: "Job description", purchases: "job_description_purchases", store: "job_descriptions", storeCol: "store_id" },
] as const;

export default async function FounderFileStoreSalesPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  // Period boundaries (UK calendar, to date).
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const year = todayStr.slice(0, 4);
  const month = todayStr.slice(5, 7);
  const qStartMonth = String(Math.floor((Number(month) - 1) / 3) * 3 + 1).padStart(2, "0");
  const monthStart = new Date(londonToUtcIso(`${year}-${month}-01T00:00`));
  const quarterStart = new Date(londonToUtcIso(`${year}-${qStartMonth}-01T00:00`));
  const yearStart = new Date(londonToUtcIso(`${year}-01-01T00:00`));

  const rows = new Map<string, Row>();
  const totals: Row = { name: "All File Store sales", type: "", mtd: blank(), qtd: blank(), ytd: blank() };

  for (const src of SOURCES) {
    // Only this year's purchases are needed (YTD covers QTD + MTD).
    const { data: purchases } = await db
      .from(src.purchases)
      .select(`${src.storeCol}, price_pence, created_at`)
      .gte("created_at", yearStart.toISOString());
    if (!purchases || purchases.length === 0) continue;

    const { data: storeRows } = await db.from(src.store).select("id, name").eq("is_store", true);
    const nameOf = new Map(
      (storeRows ?? []).map((s) => [s.id as string, ((s.name as string) ?? "Untitled") || "Untitled"])
    );

    for (const p of purchases) {
      const id = (p as Record<string, unknown>)[src.storeCol] as string;
      const key = `${src.type}:${id}`;
      const name = nameOf.get(id) ?? "Removed item";
      const row = rows.get(key) ?? { name, type: src.type, mtd: blank(), qtd: blank(), ytd: blank() };
      const when = new Date(p.created_at as string);
      const pence = (p.price_pence as number) ?? 0;
      const add = (c: Cell) => {
        c.count += 1;
        c.pence += pence;
      };
      add(row.ytd);
      add(totals.ytd);
      if (when >= quarterStart) {
        add(row.qtd);
        add(totals.qtd);
      }
      if (when >= monthStart) {
        add(row.mtd);
        add(totals.mtd);
      }
      rows.set(key, row);
    }
  }

  const list = [...rows.values()].sort(
    (a, b) => b.ytd.count - a.ytd.count || b.ytd.pence - a.ytd.pence || a.name.localeCompare(b.name)
  );
  const hasSales = list.length > 0;

  const cell = (c: Cell) => (
    <td className="px-4 py-3 text-right tabular-nums">
      <span className="font-semibold text-gray-900">{c.count}</span>
      <span className="ml-2 text-gray-500">{gbp(c.pence)}</span>
    </td>
  );

  return (
    <div>
      <Link href="/founder" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to console
      </Link>

      <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-white drop-shadow-sm">
        <ShoppingBag className="h-6 w-6" aria-hidden /> File Store sales
      </h1>
      <p className="text-sm text-white/80">
        Paid File Store purchases — forms, contracts, policies and job descriptions. Each cell shows
        number sold · revenue, to date (UK calendar).
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/40 bg-white/75 shadow-sm backdrop-blur-md">
        {!hasSales ? (
          <div className="p-10 text-center text-sm text-gray-500">
            Nothing has been purchased yet. Sales appear here once a company buys a paid File Store item.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3 text-left font-medium">Item</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">MTD (sold · £)</th>
                  <th className="px-4 py-3 text-right font-medium">QTD (sold · £)</th>
                  <th className="px-4 py-3 text-right font-medium">YTD (sold · £)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((r, i) => (
                  <tr key={i} className="hover:bg-white/60">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name}</td>
                    <td className="px-4 py-3 text-gray-500">{r.type}</td>
                    {cell(r.mtd)}
                    {cell(r.qtd)}
                    {cell(r.ytd)}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-white/50">
                  <td className="px-4 py-3 font-semibold text-gray-900" colSpan={2}>{totals.name}</td>
                  {cell(totals.mtd)}
                  {cell(totals.qtd)}
                  {cell(totals.ytd)}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
