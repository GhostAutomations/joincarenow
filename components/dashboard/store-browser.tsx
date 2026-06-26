"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Pencil, Check, Search, FileText } from "lucide-react";
import {
  acquireStoreForm,
  addStoreForm,
  addStoreFormsBulk,
  getStoreFormPreview,
} from "@/modules/forms/actions";
import { TIER_LABEL, tierRank } from "@/modules/forms/tiers";
import { FormPreview } from "@/components/dashboard/form-preview";
import { TierBadge } from "@/components/dashboard/store-badge";
import { categoryLabel, sortCategories } from "@/lib/form-categories";
import type { FormField } from "@/components/careers/apply-form";

export type StoreCard = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  store_tier: string;
  fieldCount: number;
  acquired: boolean;
};

type PreviewData = {
  form: { name: string; description: string; style: Record<string, unknown> };
  fields: FormField[];
};

// Deterministic icon colour per category — gives the store an app-store feel.
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

export function StoreBrowser({
  forms,
  companyTier,
  isAdmin,
}: {
  forms: StoreCard[];
  companyTier: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [pending, startTransition] = useTransition();
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
      return (
        f.name.toLowerCase().includes(q) ||
        (f.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [forms, query, activeCat]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function openPreview(id: string) {
    setBusyId(id);
    const data = await getStoreFormPreview(id);
    setBusyId(null);
    setPreview(data as unknown as PreviewData);
  }

  function addOne(id: string) {
    setBusyId(id);
    const fd = new FormData();
    fd.set("storeFormId", id);
    startTransition(async () => {
      await addStoreForm(undefined, fd);
      setBusyId(null);
      setAdded((p) => new Set(p).add(id));
      router.refresh();
    });
  }

  function addSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      await addStoreFormsBulk(ids);
      setAdded((p) => new Set([...p, ...ids]));
      setSelected(new Set());
      router.refresh();
    });
  }

  const pill = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
      active ? "bg-brand-600 text-white shadow-sm" : "border border-white/50 bg-white/60 text-gray-700 hover:bg-white/80"
    }`;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Search + category filter */}
      <div className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search forms…"
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

      {/* Bulk-select bar */}
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-2 z-10 mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="text-sm text-gray-700">
            {selected.size} form{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
              Clear
            </button>
            <button
              onClick={addSelected}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add {selected.size} to my forms
            </button>
          </div>
        </div>
      )}

      {/* App-store style cards */}
      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          {forms.length === 0 ? "No store forms are available yet." : "No forms match your search."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((f) => {
            const unlocked = tierRank(companyTier) >= tierRank(f.store_tier);
            const isAdded = added.has(f.id) || f.acquired;
            return (
              <div
                key={f.id}
                className="relative flex gap-4 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:border-brand-200 hover:shadow-md"
              >
                {isAdmin && !f.acquired && (
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="absolute right-3 top-3 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    aria-label={`Select ${f.name}`}
                  />
                )}

                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(f.category || "other")} text-white shadow-sm`}>
                  <FileText className="h-6 w-6" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 pr-6">
                    <h3 className="truncate font-semibold text-gray-900">{f.name}</h3>
                    {!unlocked && !f.acquired && <TierBadge tier={f.store_tier} />}
                  </div>
                  <p className="truncate text-xs capitalize text-gray-500">
                    {categoryLabel(f.category)} · {f.fieldCount} question{f.fieldCount === 1 ? "" : "s"}
                  </p>
                  {f.description && <p className="mt-1 line-clamp-2 text-sm text-gray-600">{f.description}</p>}

                  <div className="mt-2.5 flex items-center gap-3">
                    <button
                      onClick={() => openPreview(f.id)}
                      disabled={busyId === f.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>

                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        <Check className="h-3.5 w-3.5" /> Added
                      </span>
                    ) : isAdmin ? (
                      unlocked ? (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => addOne(f.id)}
                            disabled={pending}
                            className="rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-brand-700 disabled:opacity-60"
                          >
                            Add
                          </button>
                          <form action={acquireStoreForm}>
                            <input type="hidden" name="storeFormId" value={f.id} />
                            <button className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
                              <Pencil className="h-3.5 w-3.5" /> Customise
                            </button>
                          </form>
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-amber-700">
                          Requires {TIER_LABEL[f.store_tier] ?? f.store_tier} plan
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {preview && (
        <FormPreview form={preview.form} fields={preview.fields} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
