"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, ClipboardList, RefreshCw, MessagesSquare, ChevronDown, Download } from "lucide-react";
import {
  getPoppyReport,
  runPoppyForApplication,
  type PoppyReportResult,
} from "@/modules/poppy/actions";
import { loadJsPdf, poppyReportPdf, pdfSafeName } from "@/lib/pdf/poppy-report-pdf";
import { createClient } from "@/lib/supabase/client";

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

  // Live updates: every conversation step (an answer, the completion) inserts a
  // message, so refetch the report on message changes — the panel switches to
  // the finished report on the last answer without a refresh. RLS-scoped.
  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const bump = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => {
        getPoppyReport(applicationId).then(setRes);
      }, 500);
    };
    const channel = supabase
      .channel(`poppy-report-${applicationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, bump)
      .subscribe();
    return () => {
      if (pending) clearTimeout(pending);
      supabase.removeChannel(channel);
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
                className="inline-flex items-center gap-1 rounded-md border border-white/40 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white/60"
              >
                <Download className="h-3 w-3" /> PDF
              </button>
            )}
            {res.status === "ready" && (
              <button
                onClick={run}
                disabled={busy}
                className="inline-flex items-center gap-1 rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white/60 disabled:opacity-60"
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

/** Traffic-light tone for the recommendation: red = not a fit, amber = caution,
 *  green = proceed. */
function verdictTone(rec: string): "green" | "amber" | "red" {
  const t = rec.toLowerCase();
  if (/\b(not a fit|not suitable|unlikely|do not proceed|not proceed|reject|decline|not recommend|unsuitable)\b/.test(t)) return "red";
  if (/\b(caution|reservation|some concern|mixed|borderline|maybe|possibly)\b/.test(t)) return "amber";
  if (/\b(proceed|interview|good fit|strong|suitable|recommend|yes)\b/.test(t)) return "green";
  return "amber";
}
const TONE: Record<string, string> = {
  green: "bg-green-50 text-green-800",
  amber: "bg-amber-50 text-amber-800",
  red: "bg-red-50 text-red-800",
};

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
  // Tolerate legacy reports whose summary was a single string, not an array.
  const summaryList: string[] = Array.isArray(r.summary)
    ? r.summary
    : (r.summary as unknown)
      ? [r.summary as unknown as string]
      : [];
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
      {summaryList.length > 0 && (
        <div className="gap-x-5 rounded-xl border border-white/50 p-3 text-sm text-black shadow-sm sm:columns-2 lg:columns-3">
          {summaryList.map((s, i) => (
            <p key={i} className="mb-1 break-inside-avoid pl-4 -indent-4">• {s}</p>
          ))}
        </div>
      )}

      {complete && r.recommendation && (
        <p className={`mt-2 inline-flex items-start gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium ${TONE[verdictTone(r.recommendation)]}`}>
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" /> {r.recommendation}
        </p>
      )}

      {phaseNote && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
          <MessagesSquare className="h-3.5 w-3.5 text-brand-500" /> {phaseNote}
        </p>
      )}

      {r.concerns.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/50 p-3 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5" /> {complete ? "Concerns raised" : "Worth checking"}
          </p>
          <div className="mt-1 space-y-1 text-sm text-black">
            {r.concerns.map((c, i) => (
              <p key={i}>{c}</p>
            ))}
          </div>
        </div>
      )}

      {r.questions.length > 0 && (
        <div className="mt-3 rounded-xl border border-white/50 p-3 shadow-sm">
          <p className="text-sm font-bold text-amber-800">
            {complete ? "Screening Q&A" : "Screening questions"}
          </p>
          <div className="mt-1.5 gap-x-5 sm:columns-2">
            {r.questions.map((q, i) => (
              <div key={i} className="mb-2.5 break-inside-avoid text-sm">
                <p className="text-black">{q.question}</p>
                {q.answer ? (
                  <p className="mt-0.5 rounded-md bg-gray-100 px-2 py-1 font-semibold text-black">{q.answer}</p>
                ) : (
                  q.rationale && <p className="mt-0.5 text-xs text-gray-500">{q.rationale}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-2 text-[11px] text-gray-400">
        {generatedAt && `Poppy · ${new Date(generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. `}
        Poppy&apos;s assessment is advisory — a person makes the final hiring decision.
      </p>
    </div>
  );
}
