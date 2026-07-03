"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Plus, Pencil, Check, Search, FileText, CreditCard, AlertTriangle, X, Loader2 } from "lucide-react";
import {
  addStoreDoc,
  addStoreDocsBulk,
  acquireStoreDocCustomise,
  getStoreDocPreview,
} from "@/modules/contracts/actions";
import { PriceBadge, formatPrice } from "@/components/dashboard/store-badge";
import { docCategoryLabel, sortDocCategories } from "@/lib/doc-categories";

type Kind = "contract" | "policy" | "job_description";

export type DocStoreCard = {
  id: string;
  name: string;
  category: string;
  pricePence: number;
  acquired: boolean;
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

const NOUN: Record<Kind, string> = {
  contract: "contract",
  policy: "policy",
  job_description: "job description",
};

/** Company File Store browser for contracts / policies / job descriptions.
 *  Mirrors the forms StoreBrowser: free items add straight away; paid items
 *  confirm then charge the saved card. Preview shows the document text. */
export function DocStoreBrowser({
  kind,
  docs,
  isAdmin,
  billingReady,
  comped,
}: {
  kind: Kind;
  docs: DocStoreCard[];
  isAdmin: boolean;
  billingReady: boolean;
  comped: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ name: string; body: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<DocStoreCard | null>(null);

  const categories = useMemo(
    () => sortDocCategories(Array.from(new Set(docs.map((d) => d.category || "general")))),
    [docs]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (activeCat !== "all" && (d.category || "general") !== activeCat) return false;
      if (!q) return true;
      return d.name.toLowerCase().includes(q);
    });
  }, [docs, query, activeCat]);

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
    const data = await getStoreDocPreview(kind, id);
    setBusyId(null);
    if (data) setPreview(data);
  }

  function addOne(id: string) {
    setError(null);
    setBusyId(id);
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("storeId", id);
    startTransition(async () => {
      const r = await addStoreDoc(undefined, fd);
      setBusyId(null);
      setBuying(null);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setAdded((p) => new Set(p).add(id));
      router.refresh();
    });
  }

  function onAddClick(d: DocStoreCard) {
    if (d.pricePence > 0 && !comped) setBuying(d);
    else addOne(d.id);
  }

  function addSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setError(null);
    startTransition(async () => {
      const r = await addStoreDocsBulk(kind, ids);
      setAdded((p) => new Set([...p, ...ids]));
      setSelected(new Set());
      if (r.skippedPaid > 0) {
        setError(`${r.skippedPaid} paid item${r.skippedPaid === 1 ? "" : "s"} skipped — buy paid items individually.`);
      }
      router.refresh();
    });
  }

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
            placeholder={`Search ${NOUN[kind]}s…`}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setActiveCat("all")} className={pill(activeCat === "all")}>All</button>
          {categories.map((c) => (
            <button key={c} onClick={() => setActiveCat(c)} className={pill(activeCat === c)}>
              {docCategoryLabel(c)}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {isAdmin && selected.size > 0 && (
        <div className="sticky top-2 z-10 mt-3 flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur">
          <span className="text-sm text-gray-700">
            {selected.size} item{selected.size === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70">
              Clear
            </button>
            <button
              onClick={addSelected}
              disabled={pending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" /> Add {selected.size}
            </button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-500">
          {docs.length === 0 ? `No store ${NOUN[kind]}s are available yet.` : "Nothing matches your search."}
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {filtered.map((d) => {
            const isAdded = added.has(d.id) || d.acquired;
            const paid = d.pricePence > 0 && !comped;
            const blocked = paid && !billingReady;
            const selectable = isAdmin && !d.acquired && !paid;
            return (
              <div
                key={d.id}
                className="relative flex gap-4 rounded-2xl border border-white/50 bg-white/70 p-4 shadow-sm backdrop-blur-md transition hover:border-brand-200 hover:shadow-md"
              >
                {selectable && (
                  <input
                    type="checkbox"
                    checked={selected.has(d.id)}
                    onChange={() => toggle(d.id)}
                    className="absolute right-3 top-3 h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
                    aria-label={`Select ${d.name}`}
                  />
                )}

                <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${gradientFor(d.category || "general")} text-white shadow-sm`}>
                  <FileText className="h-6 w-6" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 pr-6">
                    <h3 className="truncate font-semibold text-gray-900">{d.name}</h3>
                    {!isAdded && <PriceBadge pricePence={comped ? 0 : d.pricePence} />}
                  </div>
                  <p className="truncate text-xs text-gray-500">{docCategoryLabel(d.category || "general")}</p>

                  <div className="mt-2.5 flex items-center gap-3">
                    <button
                      onClick={() => openPreview(d.id)}
                      disabled={busyId === d.id}
                      className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800 disabled:opacity-60"
                    >
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </button>

                    {isAdded ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        <Check className="h-3.5 w-3.5" /> Added
                      </span>
                    ) : isAdmin ? (
                      blocked ? (
                        <Link href="/billing" className="text-xs font-medium text-amber-700 hover:underline">
                          Set up billing to buy
                        </Link>
                      ) : (
                        <span className="flex items-center gap-2">
                          <button
                            onClick={() => onAddClick(d)}
                            disabled={pending && busyId === d.id}
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white hover:bg-brand-700 disabled:opacity-60"
                          >
                            {paid ? <><CreditCard className="h-3.5 w-3.5" /> Buy {formatPrice(d.pricePence)}</> : "Add"}
                          </button>
                          {!paid && (
                            <form action={acquireStoreDocCustomise}>
                              <input type="hidden" name="kind" value={kind} />
                              <input type="hidden" name="storeId" value={d.id} />
                              <button className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-800">
                                <Pencil className="h-3.5 w-3.5" /> Customise
                              </button>
                            </form>
                          )}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Preview">
          <button aria-label="Close" onClick={() => setPreview(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <h3 className="truncate pr-4 text-lg font-semibold text-gray-900">{preview.name || "Preview"}</h3>
              <button onClick={() => setPreview(null)} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/60 text-gray-700 hover:bg-white/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-5">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">
                {preview.body || "This template has no content yet."}
              </pre>
            </div>
          </div>
        </div>
      )}

      {buying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Buy item">
          <button aria-label="Close" onClick={() => !pending && setBuying(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Buy this {NOUN[kind]}</h3>
              <button onClick={() => !pending && setBuying(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-white/60 text-gray-700 hover:bg-white/80">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Add <strong>{buying.name}</strong> to your {NOUN[kind]}s for a one-off <strong>{formatPrice(buying.pricePence)}</strong>.
            </p>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your saved card will be <strong>charged {formatPrice(buying.pricePence)} now</strong>. It&apos;s then yours to keep and edit.</span>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={pending} onClick={() => setBuying(null)} className="rounded-lg border border-white/40 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-white/60 disabled:opacity-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => addOne(buying.id)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {pending ? "Charging…" : `Pay ${formatPrice(buying.pricePence)} & add`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
