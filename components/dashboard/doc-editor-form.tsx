"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { saveDoc } from "@/modules/contracts/actions";

type Kind = "contract" | "policy";

const MERGE_FIELDS = [
  "first_name",
  "last_name",
  "job_title",
  "role",
  "pay",
  "hours",
  "start_date",
  "company_name",
  "conditions",
];

const BACK = "/settings?s=contracts";

export function DocEditorForm({
  kind,
  doc,
}: {
  kind: Kind;
  doc: { id: string; name: string; body: string } | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(doc?.name ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const noun = kind === "contract" ? "contract template" : "policy";

  function insertField(field: string) {
    const token = `{{${field}}}`;
    const ta = taRef.current;
    if (!ta) {
      setBody((b) => b + token);
      return;
    }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    if (doc) fd.set("id", doc.id);
    const r = await saveDoc(kind, fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    router.push(BACK);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={BACK}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" /> Contracts &amp; policies
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-white drop-shadow-sm">
        {doc ? `Edit ${noun}` : `New ${noun}`}
      </h1>

      <form action={action} className="mt-6 space-y-4 rounded-2xl border border-white/40 bg-white/90 p-6 shadow-lg backdrop-blur-md">
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "contract" ? "e.g. Care Assistant — Permanent Contract" : "e.g. Data Protection (GDPR) Policy"}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        <p className="text-xs text-gray-500">
          Editing creates a new version — copies already signed are never changed.
        </p>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs text-gray-600">
            Highlight a word in the text below, then click a field to drop it in:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => insertField(f)}
                className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-brand-700 ring-1 ring-gray-200 hover:bg-brand-50 hover:ring-brand-300"
              >
                {`{{${f}}}`}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            {kind === "contract" ? "Contract text" : "Policy text"}
          </span>
          <textarea
            ref={taRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write the ${noun} here. Use the merge fields above where you want details filled in, e.g. "This contract is between {{company_name}} and {{first_name}} {{last_name}} for the role of {{role}}, starting {{start_date}}."`}
            className="mt-1 h-[55vh] min-h-[320px] w-full resize-y rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          <Link
            href={BACK}
            className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </Link>
          <button
            disabled={busy}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? "Saving…" : doc ? "Save changes" : `Create ${noun}`}
          </button>
        </div>
      </form>
    </div>
  );
}
