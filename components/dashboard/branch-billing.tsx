"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Building2, X, AlertTriangle, Loader2 } from "lucide-react";
import { createBranch, deleteBranch, type BranchState } from "@/modules/branches/actions";

export function BranchBilling({
  branches,
  companyId,
  canManage,
  rate = 7.5,
  period = "month",
  free = false,
}: {
  branches: { id: string; name: string }[];
  companyId: string;
  canManage: boolean;
  rate?: number;
  period?: "month" | "year";
  free?: boolean;
}) {
  const RATE = rate;
  const per = period === "year" ? "year" : "month";
  const router = useRouter();
  const [state, action, pending] = useActionState<BranchState, FormData>(createBranch, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [removePending, startRemove] = useTransition();

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  function confirmRemove() {
    if (!removing) return;
    const fd = new FormData();
    fd.set("id", removing.id);
    fd.set("companyId", companyId);
    startRemove(async () => {
      await deleteBranch(fd);
      setRemoving(null);
      router.refresh();
    });
  }

  const extra = Math.max(0, branches.length - 1);
  const monthly = extra * RATE;

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">
        {branches.length} total · {extra} extra · {free ? "free on Diamond" : `£${monthly.toFixed(2)}/${per === "year" ? "yr" : "mo"}`}
      </p>
      <p className="mt-1 text-sm text-gray-600">
        {free
          ? "Branches are free on your Diamond plan — add as many as your service needs at no charge."
          : `Your plan includes 1 branch. Each additional branch is £${RATE.toFixed(2)}/${per}. Adding one charges your saved card straight away (a part‑period amount for the rest of this ${per}), then £${RATE.toFixed(2)}/${per} after.`}
      </p>

      <ul className="mt-4 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {branches.map((b, i) => (
          <li key={b.id} className="flex items-center justify-between border-b border-gray-100 py-2.5">
            <span className="flex items-center gap-2 text-sm text-gray-900">
              <Building2 className="h-4 w-4 text-gray-400" />
              {b.name}
              {i === 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">included</span>}
            </span>
            {canManage && i > 0 && (
              <button
                onClick={() => setRemoving({ id: b.id, name: b.name })}
                className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                aria-label="Remove branch"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <button
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
        >
          <Plus className="h-4 w-4" /> Add a branch {free ? "(free)" : `(£${RATE.toFixed(2)}/${per === "year" ? "yr" : "mo"})`}
        </button>
      )}

      {/* Confirmation popup */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add a branch">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add a branch</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>

            {free ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Branches are <strong>free</strong> on your Diamond plan — no charge for adding this branch.</span>
              </div>
            ) : (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Your saved card will be <strong>charged now</strong> for the rest of this billing
                  period, then <strong>£{RATE.toFixed(2)}/{per}</strong> for this branch.
                </span>
              </div>
            )}

            <form ref={ref} action={action} className="mt-4">
              {state?.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
              <input type="hidden" name="companyId" value={companyId} />
              <label className="block text-sm font-medium text-gray-700">
                Branch name
                {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                <input
                  name="name"
                  autoFocus
                  placeholder="e.g. Cardiff, North Team"
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </label>
              {pending && (
                <p className="mt-3 text-xs text-gray-500">Adding the branch and updating your billing… this can take a few seconds.</p>
              )}
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={pending} onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-70">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {pending ? "Adding…" : "Confirm & add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove confirmation popup */}
      {removing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Remove branch">
          <button aria-label="Close" onClick={() => !removePending && setRemoving(null)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Remove branch</h3>
              <button onClick={() => !removePending && setRemoving(null)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              {free ? (
                <>Remove <strong>{removing.name}</strong>? Branches are free on your Diamond plan, so there&apos;s no billing change.</>
              ) : (
                <>Remove <strong>{removing.name}</strong>? The £{RATE.toFixed(2)}/{per} charge stops, and you&apos;ll be credited the unused part of this period against your next invoice.</>
              )}
            </p>
            {removePending && (
              <p className="mt-3 text-xs text-gray-500">Removing the branch and updating your billing… this can take a few seconds.</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" disabled={removePending} onClick={() => setRemoving(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" disabled={removePending} onClick={confirmRemove} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70">
                {removePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {removePending ? "Removing…" : "Remove branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
