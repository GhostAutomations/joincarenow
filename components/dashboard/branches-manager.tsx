"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Building2, Trash2, Plus, Pencil } from "lucide-react";
import { createBranch, updateBranch, deleteBranch, type BranchState } from "@/modules/branches/actions";

type Branch = {
  id: string;
  name: string;
  kind?: string;
  address_line?: string | null;
  city?: string | null;
  region?: string | null;
  postcode?: string | null;
};

/** Optional area/office address fields, shared by the add + edit forms. Filling
 *  street, region and postcode completes the job's location for Google. */
function AddressFields({ b }: { b?: Branch }) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <input name="address_line" defaultValue={b?.address_line ?? ""} placeholder="Office / area address"
        className="rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      <input name="city" defaultValue={b?.city ?? ""} placeholder="Town / city"
        className="rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      <input name="region" defaultValue={b?.region ?? ""} placeholder="County / region (e.g. Gwent)"
        className="rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
      <input name="postcode" defaultValue={b?.postcode ?? ""} placeholder="Postcode (area)"
        className="rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
    </div>
  );
}

function BranchRow({ b, companyId }: { b: Branch; companyId?: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState<BranchState, FormData>(updateBranch, undefined);

  useEffect(() => {
    if (state?.ok) { setEditing(false); router.refresh(); }
  }, [state, router]);

  const hasAddress = b.address_line || b.city || b.region || b.postcode;

  return (
    <li className="rounded-lg border border-gray-200 bg-white/80 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="truncate text-sm font-medium text-gray-900">{b.name}</span>
          {hasAddress && <span className="truncate text-xs text-gray-400">· {[b.city, b.postcode].filter(Boolean).join(" ")}</span>}
        </span>
        <span className="flex items-center gap-1">
          <button onClick={() => setEditing((v) => !v)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="Edit branch">
            <Pencil className="h-4 w-4" />
          </button>
          <form action={deleteBranch}>
            <input type="hidden" name="id" value={b.id} />
            {companyId && <input type="hidden" name="companyId" value={companyId} />}
            <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove branch">
              <Trash2 className="h-4 w-4" />
            </button>
          </form>
        </span>
      </div>

      {editing && (
        <form action={action} className="mt-2 border-t border-gray-100 pt-2">
          <input type="hidden" name="id" value={b.id} />
          {companyId && <input type="hidden" name="companyId" value={companyId} />}
          <input name="name" defaultValue={b.name} placeholder="Branch name"
            className="block w-full rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          <AddressFields b={b} />
          <p className="mt-1.5 text-xs text-gray-400">The area address appears on job adverts and helps roles show in local job searches.</p>
          {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
          <div className="mt-2 flex items-center gap-2">
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-white/40 bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/90">Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}

/** Inline add/edit/remove of branches. Each company includes 1 branch; extras
 *  are a paid add-on (£7.50/mo, free on Diamond) — billing syncs automatically. */
export function BranchesManager({
  branches,
  companyId,
  chargeable = false,
}: {
  branches: Branch[];
  companyId?: string;
  chargeable?: boolean;
}) {
  const [state, action] = useActionState<BranchState, FormData>(createBranch, undefined);
  const [showAddress, setShowAddress] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmedRef = useRef(false);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const locations = branches.filter((b) => (b.kind ?? "branch") !== "office");

  useEffect(() => {
    if (state?.ok) { ref.current?.reset(); setShowAddress(false); router.refresh(); }
  }, [state, router]);

  // The plan includes 1 branch; anything beyond the first is an extra, so ask
  // before creating it. Diamond sees the same confirm but worded as free.
  function onAddSubmit(e: FormEvent<HTMLFormElement>) {
    if (confirmedRef.current) { confirmedRef.current = false; return; }
    if (locations.length >= 1) {
      e.preventDefault();
      setConfirmOpen(true);
    }
  }
  function confirmAdd() {
    setConfirmOpen(false);
    confirmedRef.current = true;
    ref.current?.requestSubmit();
  }

  return (
    <div>
      {locations.length > 0 ? (
        <ul className="mb-3 space-y-1">
          {locations.map((b) => (
            <BranchRow key={b.id} b={b} companyId={companyId} />
          ))}
        </ul>
      ) : (
        <p className="mb-3 text-sm text-gray-500">No branches yet.</p>
      )}

      <form ref={ref} action={action} onSubmit={onAddSubmit} className="rounded-lg border border-gray-100 bg-white/40 p-2.5">
        {companyId && <input type="hidden" name="companyId" value={companyId} />}
        {state?.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
        <div className="flex items-start gap-2">
          <input
            name="name"
            placeholder="e.g. Cardiff, Newport"
            className="block flex-1 rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {showAddress ? (
          <>
            <AddressFields />
            <p className="mt-1.5 text-xs text-gray-400">Fill the area address, region and postcode so this branch&apos;s jobs show a complete location on Google.</p>
          </>
        ) : (
          <button type="button" onClick={() => setShowAddress(true)} className="mt-2 text-xs font-medium text-brand-700 hover:underline">
            + Add area address (helps local job search)
          </button>
        )}
      </form>
      <p className="mt-2 text-xs text-gray-400">
        Your plan includes 1 branch; extras are £7.50/mo each (free on Diamond). Billing updates automatically.
      </p>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/50 bg-white/90 p-5 shadow-xl backdrop-blur">
            <h3 className="text-base font-semibold text-gray-900">Add an extra branch?</h3>
            <p className="mt-2 text-sm text-gray-600">
              {chargeable
                ? "Your plan includes 1 branch. This is an extra branch and will add £7.50/mo to your subscription."
                : "Your plan includes 1 branch. This is an extra branch, and it's included free on your plan."}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg border border-white/50 bg-white/70 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/90"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAdd}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                {chargeable ? "Add for £7.50/mo" : "Add branch"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
