"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveDocumentDetails } from "@/modules/documents/actions";
import type { DocumentDetails } from "@/lib/documents/fill";

const cls =
  "mt-1 block w-full rounded-lg border border-white/50 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Company-wide values that fill contract/policy placeholders on download
 *  (Policy owner, HR contact, approval & review dates). Admin-only. */
export function DocumentDetailsForm({ details }: { details: DocumentDetails }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [d, setD] = useState<DocumentDetails>(details);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (patch: Partial<DocumentDetails>) => { setD((c) => ({ ...c, ...patch })); setSaved(false); };

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
        These fill in the standard fields on your contracts and policies (owner, approver, contact, dates)
        when you download them, so nothing is left blank.
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
          Approval date
          <input type="date" value={d.approvalDate} onChange={(e) => set({ approvalDate: e.target.value })} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Review date
          <input type="date" value={d.reviewDate} onChange={(e) => set({ reviewDate: e.target.value })} className={cls} />
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
