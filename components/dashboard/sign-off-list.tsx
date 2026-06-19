"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, CheckCircle2, ShieldCheck } from "lucide-react";
import { signOffDocument, rejectDocument, type SignOffDoc } from "@/modules/signoff/actions";

export function SignOffList({ docs }: { docs: SignOffDoc[] }) {
  const [view, setView] = useState<SignOffDoc | null>(null);

  if (docs.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-white/60 p-10 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-8 w-8 text-gray-300" />
        <p className="mt-2 text-sm font-medium text-gray-900">Nothing to sign off</p>
        <p className="mt-1 text-sm text-gray-500">Signed contracts and policies will appear here for checking.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white/60 shadow-sm">
      <ul className="divide-y divide-slate-100">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {d.title}{" "}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-500">
                    {d.docType}
                  </span>
                </p>
                <p className="text-xs text-gray-500">
                  {d.applicantName} · signed “{d.signerName}” ({d.signatureMethod === "draw" ? "drawn" : "typed"}) ·{" "}
                  {new Date(d.signedAt).toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setView(d)}
              className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
            >
              Review &amp; sign off
            </button>
          </li>
        ))}
      </ul>

      {view && <ReviewModal doc={view} onClose={() => setView(null)} />}
    </div>
  );
}

function ReviewModal({ doc, onClose }: { doc: SignOffDoc; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  async function signOff() {
    setBusy(true);
    setError(null);
    const r = await signOffDocument(doc.id);
    setBusy(false);
    if (r?.error) return setError(r.error);
    onClose();
    router.refresh();
  }

  async function reject() {
    setBusy(true);
    setError(null);
    const r = await rejectDocument(doc.id, reason);
    setBusy(false);
    if (r?.error) return setError(r.error);
    onClose();
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative mx-auto my-8 w-full max-w-2xl px-4">
        <div className="rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-gray-900">{doc.title}</h2>
              <p className="text-xs text-gray-500">{doc.applicantName} · {doc.docType}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
            {/* What you're signing off */}
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Check the signature below is a genuine name — not an “X”, initials, or random text.
              Sign off if it looks right, or reject to ask the applicant to sign again.
            </div>

            {/* The signature */}
            <div className="rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Signature</p>
              {doc.signatureMethod === "draw" && doc.signatureImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={doc.signatureImage} alt="Signature" className="mt-2 max-h-28 border-b border-gray-300" />
              ) : (
                <p className="mt-2 font-[cursive] text-3xl text-gray-900">{doc.signerName}</p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Typed/drawn as “{doc.signerName}” · signed {new Date(doc.signedAt).toLocaleString("en-GB")}
                {doc.version != null && ` · version ${doc.version}`}
              </p>
            </div>

            {/* The document text */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">View full document text</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{doc.body}</p>
            </details>

            {rejecting && (
              <div className="mt-4">
                <label className="text-xs font-medium text-gray-600">
                  Reason (the applicant will see this)
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. The signature isn't a readable name — please sign with your full name."
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </label>
              </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3">
            {!rejecting ? (
              <>
                <button
                  onClick={() => setRejecting(true)}
                  className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Reject
                </button>
                <button
                  onClick={signOff}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : "Sign off"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setRejecting(false)}
                  className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  Back
                </button>
                <button
                  onClick={reject}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Reject & ask to re-sign"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
