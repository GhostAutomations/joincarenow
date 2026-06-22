"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus, Building2 } from "lucide-react";
import { createBranch, deleteBranch, type BranchState } from "@/modules/branches/actions";

const RATE = 7.5; // £/month per extra branch

export function BranchBilling({
  branches,
  companyId,
  canManage,
}: {
  branches: { id: string; name: string }[];
  companyId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState<BranchState, FormData>(createBranch, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const [accepted, setAccepted] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      setAccepted(false);
      setAdding(false);
      router.refresh();
    }
  }, [state, router]);

  const extra = Math.max(0, branches.length - 1);
  const monthly = extra * RATE;

  return (
    <div>
      <p className="text-sm font-medium text-gray-700">
        {branches.length} total · {extra} extra · £{monthly.toFixed(2)}/mo
      </p>
      <p className="mt-1 text-sm text-gray-600">
        Your plan includes 1 branch. Each additional branch is £{RATE.toFixed(2)}/month. Adding one
        charges your saved card straight away (a part‑month amount for the rest of this period),
        then £{RATE.toFixed(2)}/month after.
      </p>

      <ul className="mt-4 divide-y divide-gray-100">
        {branches.map((b, i) => (
          <li key={b.id} className="flex items-center justify-between py-2.5">
            <span className="flex items-center gap-2 text-sm text-gray-900">
              <Building2 className="h-4 w-4 text-gray-400" />
              {b.name}
              {i === 0 && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500">included</span>}
            </span>
            {canManage && i > 0 && (
              <form
                action={deleteBranch}
                onSubmit={(e) => {
                  if (!confirm(`Remove "${b.name}"? You'll be credited the unused part of this month on your next invoice.`)) e.preventDefault();
                }}
              >
                <input type="hidden" name="id" value={b.id} />
                <input type="hidden" name="companyId" value={companyId} />
                <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove branch">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        adding ? (
          <form ref={ref} action={action} className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
            {state?.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
            <label className="block text-sm font-medium text-gray-700">
              New branch name
              <input
                name="name"
                placeholder="e.g. Cardiff, Newport, North Team"
                className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </label>
            <input type="hidden" name="companyId" value={companyId} />
            <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
              I understand my saved card will be <strong>charged now</strong> for the rest of this billing period, then <strong>£{RATE.toFixed(2)}/month</strong> for this branch.
            </label>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={!accepted}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" /> Add branch
              </button>
              <button type="button" onClick={() => { setAdding(false); setAccepted(false); }} className="text-sm text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> Add a branch (£{RATE.toFixed(2)}/mo)
          </button>
        )
      )}
    </div>
  );
}
