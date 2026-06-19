"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Send } from "lucide-react";
import { sendOffer, getOffer, getOfferDocOptions, type OfferInfo, type OfferDocOptions } from "@/modules/offers/actions";

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
  const [prev, setPrev] = useState<OfferInfo | null | "loading">("loading");
  const [conditional, setConditional] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docOpts, setDocOpts] = useState<OfferDocOptions | null>(null);
  const [contractId, setContractId] = useState("");
  const [policyIds, setPolicyIds] = useState<string[]>([]);
  const [managerId, setManagerId] = useState("");

  // Pre-fill from the existing offer so a reissue only needs the correction.
  useEffect(() => {
    getOffer(applicationId).then((o) => {
      setPrev(o);
      if (o?.conditional) setConditional(true);
    });
    getOfferDocOptions(applicationId).then((o) => {
      setDocOpts(o);
      setContractId(o.contractId ?? "");
      setPolicyIds(o.policyIds);
      setManagerId(o.managerId ?? "");
    });
  }, [applicationId]);

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

  const p = prev === "loading" ? null : prev;
  const reissue = !!p;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">{reissue ? "Reissue offer" : "Make an offer"}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {prev === "loading" ? (
          <p className="px-5 py-8 text-sm text-gray-400">Loading…</p>
        ) : (
          <form action={action} className="space-y-3 overflow-y-auto px-5 py-4">
            {reissue && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Reissuing sends the applicant a fresh offer with a new accept/decline link.
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Role</span>
                <input name="role" defaultValue={p?.role ?? defaultRole} className={input} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Start date</span>
                <input name="startDate" type="date" defaultValue={p?.startDate ?? ""} className={input} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Pay</span>
                <input name="pay" defaultValue={p?.pay ?? defaultPay} placeholder="e.g. £12.50 / hour" className={input} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Hours</span>
                <input name="hours" defaultValue={p?.hours ?? ""} placeholder="e.g. Full-time, 37.5/wk" className={input} />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-gray-600">Manager</span>
                <select
                  name="manager_id"
                  value={managerId}
                  onChange={(e) => setManagerId(e.target.value)}
                  className={input}
                >
                  <option value="">No manager</option>
                  {(docOpts?.managers ?? []).map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] text-gray-400">Who they&apos;ll report to — set on their employee record &amp; sent to Carer.Academy.</span>
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
                <textarea name="conditions" rows={2} defaultValue={p?.conditions ?? ""} placeholder="e.g. satisfactory references, DBS and Right to Work" className={input} />
              </label>
            )}

            <label className="block">
              <span className="text-xs font-medium text-gray-600">Message to the applicant <span className="font-normal text-gray-400">(optional)</span></span>
              <textarea name="message" rows={3} defaultValue={p?.message ?? ""} placeholder="A short personal note to go with the offer…" className={input} />
            </label>

            {/* Contract + policies the applicant will sign on accepting. */}
            {docOpts && (docOpts.contracts.length > 0 || docOpts.policies.length > 0) && (
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                <p className="text-xs font-medium text-gray-700">To sign on acceptance</p>
                {docOpts.contracts.length > 0 && (
                  <label className="mt-2 block">
                    <span className="text-xs text-gray-500">Contract</span>
                    <select
                      name="contract_template_id"
                      value={contractId}
                      onChange={(e) => setContractId(e.target.value)}
                      className={input}
                    >
                      <option value="">No contract</option>
                      {docOpts.contracts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                {docOpts.policies.length > 0 && (
                  <div className="mt-2">
                    <span className="text-xs text-gray-500">Policies</span>
                    <div className="mt-1 space-y-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
                      {docOpts.policies.map((pol) => (
                        <label key={pol.id} className="flex items-center gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            name="policy_ids"
                            value={pol.id}
                            checked={policyIds.includes(pol.id)}
                            onChange={(e) =>
                              setPolicyIds((prevIds) =>
                                e.target.checked
                                  ? [...prevIds, pol.id]
                                  : prevIds.filter((id) => id !== pol.id)
                              )
                            }
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          {pol.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-gray-400">
                  Pre-selected from the job — adjust if needed. The applicant signs these when they accept.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
              <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
                Cancel
              </button>
              <button
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" /> {busy ? "Sending…" : reissue ? "Reissue offer" : "Send offer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
