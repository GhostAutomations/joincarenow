"use client";

import { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, AlertTriangle, ClipboardList, RefreshCw } from "lucide-react";
import {
  getPoppyReport,
  runPoppyForApplication,
  type PoppyReportResult,
} from "@/modules/poppy/actions";

/**
 * Poppy on the applicant panel. Shows the screening report (summary / strengths
 * / concerns / recommendation + questions) once generated — automatically by a
 * Poppy workflow step, or on demand via "Run Poppy". Renders nothing unless the
 * company has Poppy.
 */
export function ApplicantPoppyReport({ applicationId }: { applicationId: string }) {
  const [res, setRes] = useState<PoppyReportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    return getPoppyReport(applicationId).then(setRes);
  }
  useEffect(() => {
    let alive = true;
    setRes(null);
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

  // Still checking, or company doesn't have Poppy → render nothing.
  if (res === null) return null;
  if (!res.entitled) return null;

  const Header = (
    <div className="flex items-center justify-between">
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
        <Sparkles className="h-3.5 w-3.5 text-brand-500" /> Poppy · Screening report
      </p>
      {res.status === "ready" && (
        <button
          onClick={run}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3 w-3 ${busy ? "animate-spin" : ""}`} /> {busy ? "Working…" : "Regenerate"}
        </button>
      )}
    </div>
  );

  if (busy) {
    return (
      <div>
        {Header}
        <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
          <Sparkles className="h-4 w-4 animate-pulse text-brand-500" /> Poppy is reviewing the application…
        </p>
      </div>
    );
  }

  // No report yet — offer to run it now.
  if (res.status !== "ready" || !res.report) {
    return (
      <div>
        {Header}
        <p className="mt-1 text-sm text-gray-500">
          No screening report yet. It runs automatically when this applicant reaches your Poppy workflow step — or run it now.
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
    );
  }

  const r = res.report;
  return (
    <div>
      {Header}
      {r.summary && <p className="mt-1.5 text-sm text-gray-800">{r.summary}</p>}

      {r.recommendation && (
        <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-800">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" /> {r.recommendation}
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {r.strengths.length > 0 && (
          <div className="rounded-xl border border-white/50 bg-white/60 p-3 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
              {r.strengths.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}
        {r.concerns.length > 0 && (
          <div className="rounded-xl border border-white/50 bg-white/60 p-3 backdrop-blur-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" /> Worth checking
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
              {r.concerns.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>

      {r.questions.length > 0 && (
        <div className="mt-3 space-y-3">
          <p className="text-xs font-semibold text-gray-500">Suggested interview questions</p>
          {r.questions.map((g, gi) => (
            <div key={gi} className="rounded-xl border border-white/50 bg-white/60 p-3 backdrop-blur-sm">
              <p className="text-xs font-semibold text-brand-700">{g.category}</p>
              <ul className="mt-1.5 space-y-2">
                {g.questions.map((q, qi) => (
                  <li key={qi} className="text-sm">
                    <p className="text-gray-900">{q.question}</p>
                    {q.rationale && <p className="mt-0.5 text-xs text-gray-500">{q.rationale}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {res.generatedAt && (
        <p className="mt-2 text-[11px] text-gray-400">
          Generated by Poppy {new Date(res.generatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Review before use.
        </p>
      )}
    </div>
  );
}
