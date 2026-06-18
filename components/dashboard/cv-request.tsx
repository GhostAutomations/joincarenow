"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { requestCv } from "@/modules/onboarding/actions";

/** "Request CV" button + a small modal for an optional message. Sends a
 *  document task to the applicant's portal asking them to upload their CV. */
export function CvRequest({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notify, setNotify] = useState<"email" | "sms" | "none">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function send() {
    setBusy(true);
    setError(null);
    const r = await requestCv(applicationId, message, notify === "none" ? null : notify);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    if (r?.notifyError) alert(`CV requested, but the notification didn't go: ${r.notifyError}`);
    setSent(true);
    setOpen(false);
    setMessage("");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={sent}
        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
      >
        <Upload className="h-4 w-4" />
        {sent ? "CV requested" : "Request CV"}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-semibold text-gray-900">Request a CV</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4">
              <label className="block text-sm font-medium text-gray-700">
                Message to the applicant <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="e.g. Please upload an up-to-date CV so we can progress your application."
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <label className="mt-3 block">
                <span className="text-xs font-medium text-gray-600">Notify the applicant by</span>
                <select
                  value={notify}
                  onChange={(e) => setNotify(e.target.value as "email" | "sms" | "none")}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="none">Don&apos;t notify (portal only)</option>
                </select>
              </label>
              {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-gray-50/70 px-5 py-3">
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg border border-gray-300 px-3.5 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={send}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Upload className="h-4 w-4" /> {busy ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
