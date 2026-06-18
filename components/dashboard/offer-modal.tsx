"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { sendOffer } from "@/modules/offers/actions";

const input =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

/** Capture offer details and send the applicant an accept/decline link. */
export function OfferModal({
  applicationId,
  defaultRole,
  defaultPay = "",
  onClose,
}: {
  applicationId: string;
  defaultRole: string;
  defaultPay?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [conditional, setConditional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    fd.set("applicationId", applicationId);
    const r = await sendOffer(fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Make an offer</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form action={action} className="space-y-3 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Role</span>
              <input name="role" defaultValue={defaultRole} className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Start date</span>
              <input name="startDate" type="date" className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Pay</span>
              <input name="pay" defaultValue={defaultPay} placeholder="e.g. £12.50 / hour" className={input} />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Hours</span>
              <input name="hours" placeholder="e.g. Full-time, 37.5/wk" className={input} />
            </label>
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="conditional"
              checked={conditional}
              onChange={(e) => setConditional(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>This is a conditional offer (subject to checks)</span>
          </label>
          {conditional && (
            <label className="block">
              <span className="text-xs font-medium text-gray-600">Conditions</span>
              <textarea name="conditions" rows={2} placeholder="e.g. satisfactory references, DBS and Right to Work" className={input} />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium text-gray-600">Message to the applicant <span className="font-normal text-gray-400">(optional)</span></span>
            <textarea name="message" rows={3} placeholder="A short personal note to go with the offer…" className={input} />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Cancel
            </button>
            <button
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              <Send className="h-4 w-4" /> {busy ? "Sending…" : "Send offer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
