"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, Plus, Pencil, Check } from "lucide-react";
import {
  acquireStoreForm,
  addStoreForm,
  addStoreFormsBulk,
  getStoreFormPreview,
} from "@/modules/forms/actions";
import { TIER_LABEL, tierRank } from "@/modules/forms/tiers";
import { FormPreview } from "@/components/dashboard/form-preview";
import {
  CollapsibleSection,
  categoryLabel,
  sortCategories,
} from "@/components/dashboard/collapsible-section";
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
    // Cast: store fields share the apply-form FormField shape.
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

  // Group store cards by category for the collapsible sections.
  const grouped = new Map<string, StoreCard[]>();
  for (const f of forms) {
    const cat = f.category || "other";
    const list = grouped.get(cat) ?? [];
    list.push(f);
    grouped.set(cat, list);
  }
  const categories = sortCategories([...grouped.keys()]);

  return (
    <div className="mx-auto max-w-6xl">
      {isAdmin && selected.size > 0 && (
        <div className="sticky top-2 z-10 mb-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="text-sm text-gray-700">
            {selected.size} form{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
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

      <div className="space-y-3">
        {categories.map((cat) => (
          <CollapsibleSection key={cat} title={categoryLabel(cat)} count={grouped.get(cat)!.length}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.get(cat)!.map((f) => {
                const unlocked = tierRank(companyTier) >= tierRank(f.store_tier);
                const isAdded = added.has(f.id);
                return (
            <div key={f.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                {isAdmin && !f.acquired && (
                  <input
                    type="checkbox"
                    checked={selected.has(f.id)}
                    onChange={() => toggle(f.id)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    aria-label={`Select ${f.name}`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{f.name}</p>
                      <p className="text-xs capitalize text-gray-400">
                        {f.category} · {f.fieldCount} field{f.fieldCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    {f.acquired ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                        <Check className="h-3 w-3" /> In your forms
                      </span>
                    ) : (
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          f.store_tier === "free" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {TIER_LABEL[f.store_tier] ?? f.store_tier}
                      </span>
                    )}
                  </div>
                  {f.description && (
                    <p className="mt-1.5 line-clamp-2 text-sm text-gray-600">{f.description}</p>
                  )}

                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      onClick={() => openPreview(f.id)}
                      disabled={busyId === f.id}
                      title="Preview"
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>

                    {isAdmin && !f.acquired && (
                      unlocked ? (
                        <>
                          <button
                            onClick={() => addOne(f.id)}
                            disabled={pending || isAdded}
                            title="Add to my forms"
                            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                          >
                            {isAdded ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                            {isAdded ? "Added" : "Add"}
                          </button>
                          <form action={acquireStoreForm}>
                            <input type="hidden" name="storeFormId" value={f.id} />
                            <button
                              title="Customise & add"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                            >
                              <Pencil className="h-3.5 w-3.5" /> Customise
                            </button>
                          </form>
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-400">
                          Requires {TIER_LABEL[f.store_tier] ?? f.store_tier} plan
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
            </div>
                );
              })}
            </div>
          </CollapsibleSection>
        ))}
      </div>

      {preview && (
        <FormPreview form={preview.form} fields={preview.fields} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
