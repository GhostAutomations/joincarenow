"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Sparkles, Upload } from "lucide-react";
import { saveDoc } from "@/modules/contracts/actions";

/** Load mammoth (docx -> text) from cdnjs on demand (npm install is blocked). */
function loadMammoth(): Promise<{ extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> }> {
  const w = window as unknown as { mammoth?: { extractRawText: (o: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> } };
  if (w.mammoth) return Promise.resolve(w.mammoth);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";
    s.onload = () => (w.mammoth ? resolve(w.mammoth) : reject(new Error("Reader failed to load.")));
    s.onerror = () => reject(new Error("Could not load the document reader."));
    document.head.appendChild(s);
  });
}

type Kind = "contract" | "policy" | "job_description";

const MERGE_FIELDS = [
  "first_name",
  "last_name",
  "job_title",
  "role",
  "pay",
  "hours",
  "mileage",
  "start_date",
  "company_name",
  "conditions",
];

type SaveAction = (kind: Kind, fd: FormData) => Promise<{ ok?: boolean; error?: string; id?: string }>;

export function DocEditorForm({
  kind,
  doc,
  companyId,
  embedded = false,
  saveAction,
  onSaved,
  onCancel,
}: {
  kind: Kind;
  doc: { id: string; name: string; body: string; signatureMethod?: "type" | "draw" } | null;
  /** When set, the doc is saved for this company (founder setup) + sent to AI. */
  companyId?: string;
  /** Render without the page chrome (back link / heading / card), for inline use. */
  embedded?: boolean;
  /** Override the save action (defaults to the company saveDoc). */
  saveAction?: SaveAction;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(doc?.name ?? "");
  const [body, setBody] = useState(doc?.body ?? "");
  const [sigMethod, setSigMethod] = useState<"type" | "draw">(doc?.signatureMethod ?? "type");
  const [brief, setBrief] = useState("");
  const [generating, setGenerating] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const noun = kind === "contract" ? "contract template" : kind === "policy" ? "policy" : "job description";
  const isJD = kind === "job_description";
  const mergeFields = MERGE_FIELDS;
  const BACK = isJD ? "/settings?s=jobdescriptions" : "/settings?s=contracts";
  const backLabel = isJD ? "Job descriptions" : "Contracts & policies";

  async function generate() {
    if (body.trim() && !confirm(`Replace the current ${noun} text with a fresh AI-generated draft?`)) {
      return;
    }
    if (kind === "policy" && !name.trim() && !brief.trim()) {
      setError("Give the policy a name (or add a brief) so we know what to draft.");
      return;
    }
    setGenerating(true);
    setError(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 118_000);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, name, brief, companyId }),
        signal: controller.signal,
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!res.ok || data.error) {
        const msg = data.error || `Generation failed (${res.status}).`;
        setError(msg);
        alert(`Contract generation error:\n\n${msg}`);
      } else if (data.text) {
        setBody(data.text);
      } else {
        setError("The generator returned nothing. Please try again.");
        alert("The generator returned nothing.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "The generator took too long or the connection dropped.";
      setError(msg);
      alert(`Contract generation error:\n\n${msg}`);
    } finally {
      clearTimeout(timer);
      setGenerating(false);
    }
  }

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

  const fileRef = useRef<HTMLInputElement>(null);
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    if (body.trim() && !confirm("Replace the current text with the uploaded document?")) return;
    setError(null);
    const lower = file.name.toLowerCase();
    try {
      if (lower.endsWith(".docx")) {
        const mammoth = await loadMammoth();
        const arrayBuffer = await file.arrayBuffer();
        const res = await mammoth.extractRawText({ arrayBuffer });
        setBody((res.value ?? "").trim());
      } else if (lower.endsWith(".txt") || lower.endsWith(".md") || file.type.startsWith("text/")) {
        setBody((await file.text()).trim());
      } else {
        setError("Please upload a Word (.docx) or text (.txt) file — or paste the text directly. (PDFs aren't supported; copy the text out and paste it.)");
      }
    } catch {
      setError("Could not read that file. Please paste the text in instead.");
    }
  }

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    if (doc) fd.set("id", doc.id);
    if (companyId) fd.set("companyId", companyId);
    const r = await (saveAction ?? saveDoc)(kind, fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      return;
    }
    if (onSaved) onSaved();
    else router.push(BACK);
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-3xl"}>
      {!embedded && (
        <>
          <Link
            href={BACK}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <h1 className="mt-3 text-2xl font-semibold text-white drop-shadow-sm">
            {doc ? `Edit ${noun}` : `New ${noun}`}
          </h1>
        </>
      )}

      <form action={action} className={embedded ? "space-y-4" : "mt-6 space-y-4 rounded-2xl border border-white/40 bg-white/90 p-6 shadow-lg backdrop-blur-md"}>
        <label className="block">
          <span className="text-xs font-medium text-gray-600">Name</span>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "contract" ? "e.g. Care Assistant — Permanent Contract" : kind === "policy" ? "e.g. Data Protection (GDPR) Policy" : "e.g. Care Worker"}
            className="mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {!isJD && (
          <p className="text-xs text-gray-500">
            Editing creates a new version — copies already signed are never changed.
          </p>
        )}

        <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-900">
              {kind === "contract" ? "Generate a contract" : kind === "policy" ? "Generate a policy" : "Generate a job description"}
            </span>
          </div>
          <p className="mt-1 text-xs text-violet-800/80">
            {kind === "contract"
              ? "Drafts a care-sector employment contract reflecting current UK employment law and ACAS guidance, with merge fields ready to fill. Add any specifics below (optional)."
              : kind === "policy"
                ? "Drafts a care-sector policy on the topic in the Name field above, reflecting current UK employment law and ACAS guidance. Add any specifics below (optional)."
                : "Drafts a care-sector job description for the role in the Name field above. Add any specifics below (optional)."}
          </p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={
                kind === "contract"
                  ? "e.g. 6-month probation, zero-hours bank staff, mileage paid…"
                  : kind === "policy"
                    ? "e.g. covers social media, refer to disciplinary procedure…"
                    : "e.g. driver role, evenings & weekends, medication trained…"
              }
              className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-60"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? "Generating… (up to a minute)" : kind === "contract" ? "Generate contract" : kind === "policy" ? "Generate policy" : "Generate job description"}
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-violet-800/70">
            AI-generated draft for guidance only — review it (ideally with a qualified adviser)
            and check it against the latest ACAS guidance before use.
          </p>
        </div>

        <div className="rounded-lg bg-gray-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs text-gray-600">
            Highlight a word in the text below, then click a field to drop it in:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {mergeFields.map((f) => (
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

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-gray-600">Paste the text below, or:</span>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-white/60"
          >
            <Upload className="h-4 w-4" /> Upload a document
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".docx,.txt,.md,text/plain"
            onChange={onUpload}
            className="hidden"
          />
        </div>

        <label className="block">
          <span className="text-xs font-medium text-gray-600">
            {kind === "contract" ? "Contract text" : kind === "policy" ? "Policy text" : "Job description text"}
          </span>
          <textarea
            ref={taRef}
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={`Write the ${noun} here. Use the merge fields above where you want details filled in, e.g. "This contract is between {{company_name}} and {{first_name}} {{last_name}} for the role of {{role}}, starting {{start_date}}."`}
            className="mt-1 h-[55vh] min-h-[320px] w-full resize-y rounded-lg border border-white/40 px-3 py-2 font-mono text-sm leading-relaxed focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </label>

        {!isJD && (
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-700">How the applicant signs this {kind === "contract" ? "contract" : "policy"}</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${sigMethod === "type" ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
              <input
                type="radio"
                name="signature_method"
                value="type"
                checked={sigMethod === "type"}
                onChange={() => setSigMethod("type")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-gray-900">Tick &amp; type name</span>
                <span className="block text-xs text-gray-500">Applicant ticks to agree and types their name.</span>
              </span>
            </label>
            <label className={`flex flex-1 cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm ${sigMethod === "draw" ? "border-brand-500 bg-brand-50" : "border-gray-200"}`}>
              <input
                type="radio"
                name="signature_method"
                value="draw"
                checked={sigMethod === "draw"}
                onChange={() => setSigMethod("draw")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-gray-900">Tick &amp; draw signature</span>
                <span className="block text-xs text-gray-500">Applicant ticks to agree and draws their signature.</span>
              </span>
            </label>
          </div>
        </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
          {embedded ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-white/40 bg-white/60 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-white/70"
            >
              Cancel
            </button>
          ) : (
            <Link
              href={BACK}
              className="rounded-lg border border-white/40 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-white/70"
            >
              Cancel
            </Link>
          )}
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
