"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SignaturePad } from "@/components/offer/signature-pad";
import { resignDocument, type ResignDoc } from "@/modules/signoff/actions";

export function ResignDocs({ docs, defaultName }: { docs: ResignDoc[]; defaultName: string }) {
  return (
    <ul className="mt-4 space-y-3">
      {docs.map((d) => (
        <ResignCard key={d.id} doc={d} defaultName={defaultName} />
      ))}
    </ul>
  );
}

function ResignCard({ doc, defaultName }: { doc: ResignDoc; defaultName: string }) {
  const router = useRouter();
  const drawn = doc.signatureMethod === "draw";
  const [name, setName] = useState(drawn ? defaultName : "");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = drawn ? !!image : name.trim().length >= 2;

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await resignDocument(doc.id, name, drawn ? image : null);
    setBusy(false);
    if (r?.error) return setError(r.error);
    router.refresh();
  }

  return (
    <li className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-gray-900">
          {doc.title}{" "}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-500">
            {doc.docType}
          </span>
        </p>
      </div>
      {doc.rejectReason && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          Sent back: {doc.rejectReason}
        </p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-brand-700">View document</summary>
        <p className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
          {doc.body}
        </p>
      </details>

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-600">
          {drawn ? "Draw your signature" : "Type your full name to sign"}
        </p>
        {drawn ? (
          <div className="mt-1">
            <SignaturePad name={name} onChange={setImage} />
          </div>
        ) : (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            className="mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        )}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !valid}
        className="mt-3 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? "Submitting…" : "Re-sign & resubmit"}
      </button>
    </li>
  );
}
