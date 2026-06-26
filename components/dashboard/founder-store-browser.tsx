"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, FileText, Pencil } from "lucide-react";
import { TierBadge } from "@/components/dashboard/store-badge";
import { categoryLabel, sortCategories } from "@/lib/form-categories";

export type FounderStoreCard = {
  id: string;
  name: string;
  category: string;
  store_tier: string;
  fieldCount: number;
};

const GRADIENTS = [
  "from-teal-400 to-teal-600",
  "from-indigo-400 to-indigo-600",
  "from-violet-400 to-violet-600",
  "from-sky-400 to-sky-600",
  "from-emerald-400 to-emerald-600",
  "from-amber-400 to-amber-500",
  "from-rose-400 to-rose-600",
  "from-cyan-400 to-cyan-600",
];
function gradientFor(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

/** Founder-side Form Store — same App Store look as the company store, but the
 *  cards open the template builder to edit (rather than "Add"). */
export function FounderStoreBrowser({ forms }: { forms: FounderStoreCard[] }) {
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");

  const categories = useMemo(
    () => sortCategories(Array.from(new Set(forms.map((f) => f.category || "other")))),
    [forms]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return forms.filter((f) => {
      if (activeCat !== "all" && (f.category || "other") !== activeCat) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q);
    });
  }, [forms, query, activeCat]);

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      active ? "bg-brand-600 text-white shadow-sm" : "border border-white/50 bg-white/60 text-gray-700 hover:bg-white/80"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search templates…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setActiveCat("all")} className={pill(activeCat === "all")}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={pill(activeCat === c)}>
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          {forms.length === 0 ? "No store templates yet — create your first one." : "No templates match your search."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((f) => (
            <Link
              key={f.id}
              href={`/admin/forms/${f.id}/build`}
              className="group relative flex gap-4 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:border-brand-200 hover:shadow-md"
            >
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(f.category || "other")} text-white shadow-sm`}>
                <FileText className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-semibold text-gray-900">{f.name}</h3>
                  <TierBadge tier={f.store_tier} />
                </div>
                <p className="truncate text-xs capitalize text-gray-500">
                  {categoryLabel(f.category)} · {f.fieldCount} question{f.fieldCount === 1 ? "" : "s"}
                </p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 group-hover:underline">
                  <Pencil className="h-3.5 w-3.5" /> Edit template
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
