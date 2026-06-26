"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trash2, Plus } from "lucide-react";
import { createBranch, deleteBranch, type BranchState } from "@/modules/branches/actions";

/** Inline add/remove of branches. Each company includes 1 branch; extras are a
 *  paid add-on (£7.50/mo, free on Diamond) — billing syncs automatically, so no
 *  need to go to Billing just to set up your branches. */
export function BranchesManager({
  branches,
  companyId,
}: {
  branches: { id: string; name: string; kind?: string }[];
  companyId?: string;
}) {
  const [state, action] = useActionState<BranchState, FormData>(createBranch, undefined);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  // Location branches only — the Office Team target is managed separately.
  const locations = branches.filter((b) => (b.kind ?? "branch") !== "office");

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <div>
      {locations.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {locations.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white/80 px-2.5 py-2">
              <span className="flex min-w-0 items-center gap-2">
                <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate text-sm font-medium text-gray-900">{b.name}</span>
              </span>
              <form action={deleteBranch}>
                <input type="hidden" name="id" value={b.id} />
                {companyId && <input type="hidden" name="companyId" value={companyId} />}
                <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove branch">
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-gray-500">No branches yet.</p>
      )}

      <form ref={ref} action={action} className="flex items-start gap-2">
        {companyId && <input type="hidden" name="companyId" value={companyId} />}
        <div className="flex-1">
          {state?.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
          <input
            name="name"
            placeholder="e.g. Cardiff, Newport"
            className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-400">
        Your plan includes 1 branch; extras are £7.50/mo each (free on Diamond). Billing updates automatically.
      </p>
    </div>
  );
}
