"use client";

import { useState } from "react";
import { X, CheckCircle2 } from "lucide-react";
import type { ReferenceReview } from "@/modules/references/actions";

const box =
  "mt-1 min-h-[2.25rem] w-full rounded-md border border-white/40 bg-gray-50 px-3 py-2 text-sm text-gray-800";

function FieldView({
  field,
  answers,
}: {
  field: ReferenceReview["fields"][number];
  answers: Record<string, string | string[]>;
}) {
  const v = answers[field.id];
  const text = Array.isArray(v) ? v.join(", ") : v ?? "";

  if (field.field_type === "body_text") {
    return <p className="whitespace-pre-wrap text-sm text-gray-700">{field.config?.text ?? ""}</p>;
  }

  const label = <span className="block text-sm font-medium text-gray-700">{field.label}</span>;

  if (field.field_type === "signature") {
    return (
      <div>
        {label}
        {typeof v === "string" && v.startsWith("data:image") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v} alt="Signature" className="mt-1 h-24 rounded-md border border-white/40 bg-white" />
        ) : (
          <div className={box}>{v ? "Signature captured" : "—"}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {label}
      <div className={box}>{text || <span className="text-gray-400">—</span>}</div>
    </div>
  );
}

export function ReferenceReviewModal({
  data,
  onApprove,
  onReject,
  onClose,
}: {
  data: ReferenceReview;
  onApprove: () => Promise<void> | void;
  onReject: (note: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const received = data.status === "received" || data.status === "approved" || data.status === "rejected";

  async function run(fn: () => Promise<void> | void) {
    setBusy(true);
    await fn();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Reference — {data.refereeName}</h2>
            <p className="text-xs text-gray-500">{data.refereeEmail}</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-white/70 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-5">
          {!received ? (
            <p className="text-sm text-gray-500">
              This reference hasn&apos;t been completed by the referee yet.
            </p>
          ) : data.fields.length === 0 ? (
            <p className="text-sm text-gray-500">This reference form has no questions.</p>
          ) : (
            data.fields.map((f) => <FieldView key={f.id} field={f} answers={data.answers} />)
          )}
        </div>

        {received && (
          <div className="space-y-2 border-t border-gray-200 bg-gray-50/70 px-5 py-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional note (reason for requesting changes)…"
              className="block w-full rounded-md border border-white/40 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => run(onApprove)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" /> Approve
              </button>
              <button
                onClick={() => run(() => onReject(note))}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                Request changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
