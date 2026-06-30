"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, ClipboardList, RefreshCw, MessagesSquare, ChevronDown, Download } from "lucide-react";
import {
  getPoppyReport,
  runPoppyForApplication,
  type PoppyReportResult,
} from "@/modules/poppy/actions";
import { loadJsPdf, poppyReportPdf, pdfSafeName } from "@/lib/pdf/poppy-report-pdf";

/**
 * Poppy on the applicant panel. Collapsed by default (just a header) — expands
 * on click to show the screening report. Re-collapses whenever the panel is
 * reopened (fresh mount). Phase-aware; renders nothing unless the company has
 * Poppy.
 */
export function ApplicantPoppyReport({
  applicationId,
  applicantName = "Applicant",
}: {
  applicationId: string;
  applicantName?: string;
}) {
  const [res, setRes] = useState<PoppyReportResult | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function downloadPdf(report: NonNullable<PoppyReportResult["report"]>) {
    try {
      const JsPDF = await loadJsPdf();
      const buf = poppyReportPdf(JsPDF, report, applicantName);
      const blob = new Blob([buf], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${pdfSafeName(`Poppy screening ${applicantName}`)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore — best effort */
    }
  }

  function load() {
    return getPoppyReport(applicationId).then(setRes);
  }
  useEffect(() => {
    let alive = true;
    setRes(null);
    setOpen(false); // always start collapsed when the applicant changes
    getPoppyReport(applicationId).then((r) => {
      if (alive) setRes(r);
    });
    return () => {
      alive = false;
    };
  }, [applicationId]);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await runPoppyForApplication(applicationId);
    if (r.error) {
      setError(r.error);
      setBusy(false);
      return;
    }
    await load();
    setBusy(false);
  }

  if (res === null) return null;
  if (!res.entitled) return null;

  const phase = res.phase ?? "complete";
  const r = res.report;

  // One-line status for the collapsed header.
  const status = !r
    ? "Not run yet"
    : phase === "complete"
      ? r.recommendation || "Report ready"
      : phase === "declined"
        ? "Not completed by applicant"
        : phase === "conversing"
          ? "Asking the applicant…"
          : "Concerns & questions ready";

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 text-left"
        aria-expanded={open}
      >
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
          <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Poppy · Screening
        </span>
        <span className="ml-auto max-w-[55%] truncate text-xs text-gray-500">{busy ? "Working…" : status}</span>
      </button>

      {open && (
        <div className="mt-2">
          <div className="mb-2 flex items-center justify-end gap-2">
            {r && phase === "complete" && (
              <button
                onClick={() => downloadPdf(r)}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
            )}
            {res.status === "ready" && (
              <button
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> {busy ? "Working…" : "Re-run"}
              </button>
            )}
          </div>

          {busy ? (
            <p className="flex items-center gap-2 text-sm text-gray-500">
              <Sparkles className="h-4 w-4 animate-pulse text-brand-500" /> Poppy is reviewing the application…
            </p>
          ) : res.status !== "ready" || !r ? (
            <div>
              <p className="text-sm text-gray-500">
                No screening yet. Poppy runs automatically at your workflow step — or run it now.
              </p>
              {error && (
                <p className="mt-1.5 flex items-start gap-1.5 text-sm text-red-600">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </p>
              )}
              <button
                onClick={run}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
              >
                <Sparkles className="h-4 w-4" /> Run Poppy screening
              </button>
            </div>
          ) : (
            <Report r={r} phase={phase} generatedAt={res.generatedAt ?? null} />
          )}
        </div>
      )}
    </div>
  );
}

function Report({
  r,
  phase,
  generatedAt,
}: {
  r: NonNullable<PoppyReportResult["report"]>;
  phase: string;
  generatedAt: string | null;
}) {
  const complete = phase === "complete";
  const phaseNote =
    phase === "analysed"
      ? "Concerns and screening questions ready — Poppy will ask the applicant next."
      : phase === "conversing"
        ? "Poppy is asking the applicant these questions in their portal."
        : phase === "declined"
          ? "The applicant didn't complete the screening conversation."
          : null;

  return (
    <div>
      {r.summary && <p className="text-sm text-gray-800">{r.summary}</p>}

      {complete && r.recommendation && (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-800">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" /> {r.recommendation}
        </p>
      )}

      {phaseNote && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <MessagesSquare className="h-3.5 w-3.5 text-brand-500" /> {phaseNote}
        </p>
      )}

      {r.concerns.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/50 bg-white/60 p-3 backdrop-blur-sm">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> Worth checking
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
            {r.concerns.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {r.questions.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/50 bg-white/60 p-3 backdrop-blur-sm">
          <p className="text-xs font-semibold text-brand-700">
            {complete ? "Screening questions & answers" : "Screening questions"}
          </p>
          <ul className="mt-1.5 space-y-2.5">
            {r.questions.map((q, i) => (
              <li key={i} className="text-sm">
                <p className="text-gray-900">{q.question}</p>
                {q.answer ? (
                  <p className="mt-0.5 rounded-md bg-brand-50/60 px-2 py-1 text-gray-800">{q.answer}</p>
                ) : (
                  q.rationale && <p className="mt-0.5 text-xs text-gray-500">{q.rationale}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {generatedAt && (
        <p className="mt-2 text-[11px] text-gray-400">
          Poppy · {new Date(generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Review before use.
        </p>
      )}
    </div>
  );
}
