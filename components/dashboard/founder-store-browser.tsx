"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, FileText, Pencil, Trash2 } from "lucide-react";
import { PriceBadge } from "@/components/dashboard/store-badge";
import { deleteStoreFormsBulk } from "@/modules/forms/actions";
import { categoryLabel, sortCategories } from "@/lib/form-categories";

export type FounderStoreCard = {
  id: string;
  name: string;
  category: string;
  price_pence: number;
  fieldCount: number;
  published: boolean;
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

/** Founder-side File Store — same App Store look as the company store, but the
 *  cards open the template builder to edit (rather than "Add"). */
export function FounderStoreBrowser({ forms }: { forms: FounderStoreCard[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} template${ids.length === 1 ? "" : "s"}? This can't be undone.`)) return;
    startTransition(async () => {
      await deleteStoreFormsBulk(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

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

      {/* Founder-only selection actions */}
      {selected.size > 0 && (
        <div className="sticky top-2 z-10 mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="text-sm text-gray-700">
            {selected.size} template{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70">
              Clear
            </button>
            <button
              onClick={deleteSelected}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Delete {selected.size}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          {forms.length === 0 ? "No store templates yet — create your first one." : "No templates match your search."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((f) => (
            <div
              key={f.id}
              className={`group relative flex gap-4 rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:shadow-md ${
                selected.has(f.id) ? "border-brand-400 ring-1 ring-brand-300" : "border-white/50 hover:border-brand-200"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(f.id)}
                onChange={() => toggle(f.id)}
                className="absolute right-3 top-3 h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                aria-label={`Select ${f.name}`}
              />
              <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(f.category || "other")} text-white shadow-sm`}>
                <FileText className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 pr-6">
                  <h3 className="truncate font-semibold text-gray-900">{f.name}</h3>
                  <PriceBadge pricePence={f.price_pence} />
                  {f.published ? (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">Live</span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Draft</span>
                  )}
                </div>
                <p className="truncate text-xs capitalize text-gray-500">
                  {categoryLabel(f.category)} · {f.fieldCount} question{f.fieldCount === 1 ? "" : "s"}
                </p>
                <Link
                  href={`/founder/forms/${f.id}/build`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit template
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
