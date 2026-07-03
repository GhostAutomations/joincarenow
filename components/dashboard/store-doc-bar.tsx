"use client";

import { useActionState, useState, type SyntheticEvent } from "react";
import { Globe, EyeOff } from "lucide-react";
import {
  saveStoreDocDetails,
  setStoreDocPublished,
  type StoreDocState,
} from "@/modules/contracts/actions";
import { DOC_CATEGORIES } from "@/lib/doc-categories";

type Kind = "contract" | "policy" | "job_description";

const cls =
  "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Store settings for a contract/policy/job-description template: category +
 *  one-off price (auto-saved) and publish/unpublish. The name + body live in the
 *  DocEditorForm above this bar. Mirrors StoreFormBar. */
export function StoreDocBar({
  kind,
  docId,
  category,
  pricePence,
  published,
}: {
  kind: Kind;
  docId: string;
  category: string;
  pricePence: number;
  published: boolean;
}) {
  const [saveState, saveAction] = useActionState<StoreDocState, FormData>(saveStoreDocDetails, {});
  const [pubState, pubAction] = useActionState<StoreDocState, FormData>(setStoreDocPublished, {});
  const [categoryV, setCategoryV] = useState(category || "");
  const [priceV, setPriceV] = useState(pricePence > 0 ? (pricePence / 100).toFixed(2) : "");

  const autosave = (e: SyntheticEvent<HTMLInputElement | HTMLSelectElement>) =>
    e.currentTarget.form?.requestSubmit();

  return (
    <div className="space-y-3">
      <form
        action={saveAction}
        className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md"
      >
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={docId} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">
            Category
            <select
              name="category"
              value={categoryV}
              onChange={(e) => {
                setCategoryV(e.target.value);
                e.currentTarget.form?.requestSubmit();
              }}
              className={cls}
            >
              <option value="" disabled>
                Select a category…
              </option>
              {DOC_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Price
            <div className="relative mt-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                £
              </span>
              <input
                name="price"
                inputMode="decimal"
                value={priceV}
                onChange={(e) => setPriceV(e.target.value)}
                onBlur={autosave}
                placeholder="0.00"
                className={`${cls} mt-0 pl-7`}
              />
            </div>
            <span className="mt-1 block text-xs text-gray-400">
              Leave blank or 0 for a free / included template.
            </span>
          </label>
        </div>
      </form>

      <div className="rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            {published ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800">
                <Globe className="h-3.5 w-3.5" /> Live in the File Store
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800">
                <EyeOff className="h-3.5 w-3.5" /> Draft — not visible to companies
              </span>
            )}
            {(pubState?.error || saveState?.error) && (
              <span className="text-sm text-red-600">{pubState?.error || saveState?.error}</span>
            )}
          </div>

          <form action={pubAction}>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={docId} />
            <input type="hidden" name="publish" value={(!published).toString()} />
            <button
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium text-white ${
                published ? "bg-gray-600 hover:bg-gray-700" : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {published ? "Unpublish" : "Publish"}
            </button>
          </form>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Save the name and text below first, set a category and price here, then publish to make it
          available in every company&apos;s File Store.
        </p>
      </div>
    </div>
  );
}
