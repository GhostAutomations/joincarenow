"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDocumentDetails } from "@/modules/documents/actions";
import type { DocDefaults } from "@/lib/documents/fill";

const cls =
  "mt-1 block w-full rounded-lg border border-white/50 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Company-wide defaults that auto-fill contract/policy placeholders on download
 *  (Policy owner, approver, HR contact, review period). Dates are derived per
 *  document from when it was last saved. Admin-only. */
export function DocumentDetailsForm({ details }: { details: DocDefaults }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<DocDefaults>(details);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<DocDefaults>) => { setD((c) => ({ ...c, ...patch })); setSaved(false); };

  function save() {
    setSaved(false); setError(null);
    start(async () => {
      const res = await saveDocumentDetails(d);
      if (res.error) setError(res.error);
      else { setSaved(true); router.refresh(); }
    });
  }

  return (
    <div>
      <p className="mb-3 text-xs text-gray-500">
        Set these once — they auto-fill the standard fields on every contract and policy when you download it.
        The approval and review dates are filled automatically from when each document was last saved.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Policy owner (name / job title)
          <input value={d.policyOwner} onChange={(e) => set({ policyOwner: e.target.value })} placeholder="e.g. Jane Smith, Registered Manager" className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Approved by (name / job title)
          <input value={d.approvedBy} onChange={(e) => set({ approvedBy: e.target.value })} placeholder="e.g. Phil Davies, Director" className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          HR / People contact (name)
          <input value={d.hrContactName} onChange={(e) => set({ hrContactName: e.target.value })} placeholder="e.g. People Team" className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          HR / People contact (email)
          <input type="email" value={d.hrContactEmail} onChange={(e) => set({ hrContactEmail: e.target.value })} placeholder="e.g. hr@yourcompany.co.uk" className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Review period (months)
          <input
            type="number"
            min={1}
            max={120}
            value={d.reviewMonths}
            onChange={(e) => set({ reviewMonths: Number(e.target.value) })}
            className={cls}
          />
          <span className="mt-1 block text-[11px] font-normal text-gray-400">
            Review date = last saved date + this many months. Default 24.
          </span>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save document details"}
        </button>
        {saved && <span className="text-sm text-green-700">Saved.</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
