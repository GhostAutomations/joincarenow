"use client";

import { useState } from "react";
import { CheckCircle2, X, FileText, ChevronDown, ChevronUp } from "lucide-react";
import { respondToOffer, signAndAcceptOffer, type SignableDoc } from "@/modules/offers/actions";
import { SignaturePad } from "@/components/offer/signature-pad";

type DocSign = { open: boolean; agreed: boolean; name: string; image: string };

export type TokenOffer = {
  token: string;
  status: string;
  role: string | null;
  startDate: string | null;
  pay: string | null;
  hours: string | null;
  conditional: boolean;
  conditions: string | null;
  message: string | null;
  companyName: string;
  jobTitle: string | null;
  firstName: string | null;
};

export function OfferRespond({
  offer,
  documents = [],
  signerDefaultName = "",
}: {
  offer: TokenOffer;
  documents?: SignableDoc[];
  signerDefaultName?: string;
}) {
  const [status, setStatus] = useState(offer.status);
  const [busy, setBusy] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [talentPool, setTalentPool] = useState(true);
  const [declinedWithPool, setDeclinedWithPool] = useState(false);
  const [signing, setSigning] = useState(false);
  const [docSigns, setDocSigns] = useState<DocSign[]>([]);

  function startAccept() {
    setError(null);
    if (documents.length > 0) {
      setDocSigns(
        documents.map((d) => ({
          open: false,
          agreed: false,
          // Type-to-sign: applicant types their own name. Draw-to-sign: pre-fill
          // the name for the "Signing as" guide.
          name: d.signatureMethod === "draw" ? signerDefaultName : "",
          image: "",
        }))
      );
      setSigning(true);
    } else {
      void accept();
    }
  }

  function updateDoc(i: number, patch: Partial<DocSign>) {
    setDocSigns((prev) => prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  }

  // Accordion: opening a document collapses the others (keeps the screen tidy,
  // so the one you just signed closes when you open the next).
  function toggleOpen(i: number) {
    setDocSigns((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, open: !d.open } : { ...d, open: false }))
    );
  }

  function docDone(i: number): boolean {
    const s = docSigns[i];
    const d = documents[i];
    if (!s || !d || !s.agreed) return false;
    return d.signatureMethod === "draw" ? !!s.image : s.name.trim().length >= 2;
  }

  async function accept() {
    setBusy("accepted");
    setError(null);
    const res = await respondToOffer(offer.token, "accepted");
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setStatus("accepted");
  }

  async function signAndAccept() {
    setBusy("accepted");
    setError(null);
    const res = await signAndAcceptOffer(
      offer.token,
      docSigns.map((s) => ({ name: s.name, image: s.image || null }))
    );
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setSigning(false);
    setStatus("accepted");
  }

  const canSign = documents.length > 0 && documents.every((_, i) => docDone(i));

  async function confirmDecline() {
    setBusy("declined");
    setError(null);
    const res = await respondToOffer(offer.token, "declined", { reason, talentPool });
    setBusy(null);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setDeclinedWithPool(talentPool);
    setDeclining(false);
    setStatus("declined");
  }

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between gap-4 border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">
        {offer.conditional ? "Conditional job offer" : "Job offer"} — {offer.companyName}
      </h2>
      {offer.role && <p className="mt-1 text-sm text-gray-600">{offer.role}</p>}

      <div className="mt-4">
        {offer.startDate && <Row label="Start date" value={new Date(offer.startDate).toLocaleDateString("en-GB")} />}
        {offer.pay && <Row label="Pay" value={offer.pay} />}
        {offer.hours && <Row label="Hours" value={offer.hours} />}
        {offer.conditional && offer.conditions && <Row label="Conditions" value={offer.conditions} />}
      </div>

      {offer.message && (
        <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{offer.message}</p>
      )}

      {status === "accepted" ? (
        <div className="mt-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="flex items-center gap-1.5 font-medium"><CheckCircle2 className="h-4 w-4" /> Offer accepted</p>
          <p className="mt-1">Thank you — {offer.companyName} will be in touch with next steps.</p>
        </div>
      ) : status === "declined" ? (
        <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p>You&apos;ve declined this offer. Thank you for letting us know.</p>
          {declinedWithPool && (
            <p className="mt-2">
              We&apos;ll keep your details on file so {offer.companyName} can contact you about
              future roles for up to six months. You can ask to be removed at any time.
            </p>
          )}
        </div>
      ) : signing ? (
        <div className="mt-5 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-gray-700">
            Please open and sign each document below. You can accept once all are signed.
          </p>

          {documents.map((d, i) => {
            const s = docSigns[i];
            const done = docDone(i);
            return (
              <div key={`${d.docType}-${d.sourceId ?? i}`} className="rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleOpen(i)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                  )}
                  <span className="text-sm font-medium text-gray-900">{d.title}</span>
                  <span className="ml-auto flex items-center gap-2">
                    <span className={`text-[11px] uppercase tracking-wide ${done ? "text-green-600" : "text-gray-400"}`}>
                      {done ? "Signed" : "To sign"}
                    </span>
                    {s?.open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                  </span>
                </button>

                {s?.open && (
                  <div className="border-t border-gray-100 px-3 py-3">
                    <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-700">
                      {d.body}
                    </div>

                    <label className="mt-3 flex items-start gap-2 text-sm text-gray-800">
                      <input
                        type="checkbox"
                        checked={s.agreed}
                        onChange={(e) => updateDoc(i, { agreed: e.target.checked })}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300"
                      />
                      <span>
                        {d.docType === "contract"
                          ? "I have read and agree to this contract."
                          : "I have read and understood this policy."}
                      </span>
                    </label>

                    <div className="mt-3">
                      {d.signatureMethod === "draw" ? (
                        <SignaturePad name={s.name} onChange={(img) => updateDoc(i, { image: img })} />
                      ) : (
                        <label className="block">
                          <span className="text-xs font-medium text-gray-600">Type your full name to sign</span>
                          <input
                            value={s.name}
                            onChange={(e) => updateDoc(i, { name: e.target.value })}
                            placeholder="e.g. Jane Smith"
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={signAndAccept}
              disabled={!canSign || busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" /> {busy === "accepted" ? "Signing…" : "Sign & accept offer"}
            </button>
            <button
              onClick={() => setSigning(false)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Back
            </button>
          </div>
        </div>
      ) : declining ? (
        <div className="mt-5 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-sm text-gray-700">
            Sorry to hear that. If you don&apos;t mind, could you let us know why? (optional)
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. accepted another role, pay, location, timing…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={talentPool}
              onChange={(e) => setTalentPool(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span>
              Keep my details on file so {offer.companyName} can contact me about future roles
              (talent pool) for up to six months. You can ask us to remove your details at any time.
            </span>
          </label>
          <div className="flex flex-wrap gap-3 pt-1">
            <button
              onClick={confirmDecline}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-60"
            >
              {busy === "declined" ? "Saving…" : "Confirm decline"}
            </button>
            <button
              onClick={() => setDeclining(false)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5">
          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={startAccept}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />{" "}
              {busy === "accepted" ? "Saving…" : documents.length > 0 ? "Review & accept" : "Accept offer"}
            </button>
            <button
              onClick={() => setDeclining(true)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-60"
            >
              <X className="h-4 w-4" /> Decline
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
