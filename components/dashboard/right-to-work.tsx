"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, FileText, Upload } from "lucide-react";
import { verifyRightToWork, getRtwDocUrl } from "@/modules/applications/actions";

export type RtwInfo = {
  verifiedAt: string | null;
  shareCode: string | null;
  expiry: string | null;
  hasDoc: boolean;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function RightToWork({ applicationId, rtw }: { applicationId: string; rtw: RtwInfo }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  async function viewDoc() {
    const r = await getRtwDocUrl(applicationId);
    if (r.url) window.open(r.url, "_blank");
    else alert(r.error);
  }

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    fd.set("applicationId", applicationId);
    const r = await verifyRightToWork(fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  const verified = !!rtw.verifiedAt;
  const daysToExpiry = rtw.expiry
    ? Math.ceil((new Date(rtw.expiry).getTime() - Date.now()) / 86400000)
    : null;
  const expired = daysToExpiry !== null && daysToExpiry < 0;
  const expiringSoon = daysToExpiry !== null && daysToExpiry >= 0 && daysToExpiry <= 30;

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">Right to work</p>

      {verified && !editing ? (
        <div className="mt-1.5 rounded-xl border border-green-200 bg-green-50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-green-800">
            <ShieldCheck className="h-4 w-4" /> Verified
            <span className="font-normal text-green-700">
              · {new Date(rtw.verifiedAt!).toLocaleDateString("en-GB")}
            </span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-gray-700">
            <p>
              <span className="text-xs uppercase tracking-wide text-gray-400">Share code</span>
              <br />
              {rtw.shareCode || <span className="text-gray-400">—</span>}
            </p>
            <p>
              <span className="text-xs uppercase tracking-wide text-gray-400">Expiry</span>
              <br />
              {rtw.expiry ? (
                <span className={expired ? "font-medium text-red-600" : expiringSoon ? "font-medium text-amber-600" : ""}>
                  {new Date(rtw.expiry).toLocaleDateString("en-GB")}
                  {expired ? " (expired)" : expiringSoon ? ` (in ${daysToExpiry}d)` : ""}
                </span>
              ) : (
                <span className="text-gray-400">—</span>
              )}
            </p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            {rtw.hasDoc && (
              <button
                onClick={viewDoc}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                <FileText className="h-3.5 w-3.5" /> View document
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:underline"
            >
              Update
            </button>
          </div>
        </div>
      ) : editing || !verified ? (
        <form action={action} className="mt-1.5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Share code</span>
              <input name="shareCode" defaultValue={rtw.shareCode ?? ""} placeholder="e.g. W12 345 678" className={inputClass} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Expiry date</span>
              <input name="expiry" type="date" defaultValue={rtw.expiry ?? ""} className={inputClass} />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Upload confirmed document</span>
            <input
              name="doc"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              className="mt-1 block w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" name="declaration" required className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>
              I confirm I have checked the original Right to Work document and that it is a true
              likeness of the applicant.
            </span>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex items-center gap-2">
            <button
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Upload className="h-4 w-4" /> {busy ? "Saving…" : "Confirm right to work"}
            </button>
            {editing && verified && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : null}
    </div>
  );
}
