"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { SignaturePad } from "@/components/offer/signature-pad";
import { signOnboardingDocument, confirmOnboardingDocument } from "@/modules/onboarding/actions";

/**
 * Applicant read-&-sign panel for a contract/policy onboarding task. Shows the
 * merge-filled document, then captures a signature — by the method the company
 * chose (type name, draw, or "signature not required" = read & confirm only).
 */
export function SignDocument({
  taskId,
  title,
  body,
  kind,
  defaultName,
  alreadySigned,
  signatureMethod,
}: {
  taskId: string;
  title: string;
  body: string;
  kind: string;
  defaultName: string;
  alreadySigned: boolean;
  signatureMethod: "type" | "draw" | "none";
}) {
  const router = useRouter();
  const noSig = signatureMethod === "none";
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadySigned);

  const canSign = agreed && (noSig ? true : signatureMethod === "draw" ? !!image : name.trim().length >= 2);

  async function submit() {
    setBusy(true);
    setError(null);
    const r = noSig
      ? await confirmOnboardingDocument(taskId)
      : await signOnboardingDocument(
          taskId,
          signatureMethod === "draw" ? defaultName : name,
          signatureMethod === "draw" ? image : null
        );
    setBusy(false);
    if (r?.error) return setError(r.error);
    setDone(true);
    router.refresh();
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-green-300 bg-green-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-green-600" />
        <p className="mt-2 text-sm font-medium text-green-800">
          Thank you — “{title}” has been {noSig ? "confirmed" : "signed"}.
        </p>
        <button
          onClick={() => router.push("/portal")}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Back to my portal
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/50 bg-white/70 p-6 shadow-sm backdrop-blur-md sm:p-8">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-500">
          {kind}
        </span>
      </div>

      <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-xl border border-white/60 bg-white/80 p-4 text-sm leading-relaxed text-gray-800">
        <p className="whitespace-pre-wrap">{body}</p>
      </div>

      <label className="mt-5 flex items-start gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500"
        />
        I confirm I have read {noSig ? "this document" : "and agree to the above"}.
      </label>

      {!noSig && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-600">
            {signatureMethod === "draw" ? "Draw your signature" : "Type your full name to sign"}
          </p>
          {signatureMethod === "draw" ? (
            <SignaturePad name={defaultName} onChange={setImage} />
          ) : (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Type your full name"
              className="block w-full rounded-lg border border-white/60 bg-white/80 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !canSign}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Saving…" : noSig ? "Confirm" : "Sign & submit"}
      </button>
    </div>
  );
}
