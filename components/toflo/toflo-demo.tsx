"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";

/**
 * Animated AI-screening demo for the Toflo coming-soon page. Decorative only.
 * Generic, cross-industry content (no care-sector specifics). Act 1 — the
 * candidate's chat with the Toflo assistant. Act 2 — the handoff: a recruiter
 * pipeline frame slides in, first "writing the report", then the finished
 * report. Loops; starts in view; respects prefers-reduced-motion.
 */

type Msg = { from: "ai" | "candidate"; text: string };

const SCRIPT: Msg[] = [
  { from: "ai", text: "Hi Alex, I'm the Toflo hiring assistant for Northwind. Thanks for applying for Customer Support Specialist. OK if I ask a few quick questions?" },
  { from: "candidate", text: "Sure, go ahead." },
  { from: "ai", text: "I noticed a gap in your work history last year. Could you tell me a little about it?" },
  { from: "candidate", text: "I took time out to complete a coding course." },
  { from: "ai", text: "Nice. And are you comfortable with occasional weekend shifts?" },
  { from: "candidate", text: "Yes, weekends are fine." },
  { from: "ai", text: "That's everything I need. I'll pass your answers to the team. Good luck!" },
];

const FIRST_MESSAGE_DELAY = 400;
const AI_DELAY = 1500;
const CANDIDATE_DELAY = 1500;
const BEFORE_HANDOFF_MS = 1000;
const REPORT_WRITING_MS = 2200;
const REPORT_HOLD_MS = 10000;

function AiAvatar() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-sm">
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function Chrome({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
      <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      <span className="ml-3 hidden flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-gray-400 sm:block">{url}</span>
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const ai = msg.from === "ai";
  return (
    <div className={`jcn-msg-in flex items-end gap-2 ${ai ? "" : "flex-row-reverse"}`}>
      {ai ? (
        <AiAvatar />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-600 text-[11px] font-semibold text-white">AR</span>
      )}
      <p
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow-sm ${
          ai ? "rounded-bl-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white" : "rounded-br-sm bg-gray-100 text-gray-800"
        }`}
      >
        {msg.text}
      </p>
    </div>
  );
}

export function TofloDemo() {
  const [shown, setShown] = useState(0);
  const [phase, setPhase] = useState<"chat" | "writing" | "report">("chat");
  const [started, setStarted] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setReduced(true);
      setShown(SCRIPT.length);
      setPhase("report");
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setStarted(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!started || reduced) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (phase === "chat") {
      if (shown < SCRIPT.length) {
        const next = SCRIPT[shown];
        timers.push(
          setTimeout(
            () => setShown((n) => n + 1),
            shown === 0 ? FIRST_MESSAGE_DELAY : next.from === "ai" ? AI_DELAY : CANDIDATE_DELAY
          )
        );
      } else {
        timers.push(setTimeout(() => setPhase("writing"), BEFORE_HANDOFF_MS));
      }
    } else if (phase === "writing") {
      timers.push(setTimeout(() => setPhase("report"), REPORT_WRITING_MS));
    } else {
      timers.push(
        setTimeout(() => {
          setShown(0);
          setPhase("chat");
        }, REPORT_HOLD_MS)
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [started, reduced, phase, shown]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown]);

  const handoff = phase !== "chat";

  return (
    <div ref={rootRef} aria-hidden className="relative text-left">
      {/* Act 1 — the candidate's chat */}
      <div
        className={`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-700 ${
          handoff ? "scale-[0.98] opacity-50" : "opacity-100"
        }`}
      >
        <Chrome url="toflo.co.uk · the candidate's view" />
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          <AiAvatar />
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Toflo · screening chat</p>
            <p className="text-[10px] text-gray-400">With the candidate&apos;s consent</p>
          </div>
        </div>
        <div ref={scrollRef} className="flex h-[480px] flex-col gap-3 overflow-hidden bg-gray-50/60 p-4 sm:p-5">
          {SCRIPT.slice(0, shown).map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
        </div>
      </div>

      {/* Act 2 — the handoff: recruiter pipeline, writing then report */}
      <div
        className={`absolute inset-x-0 -bottom-6 z-10 mx-auto w-[94%] transition-all duration-700 sm:-bottom-8 sm:w-[88%] ${
          handoff ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-2xl ring-1 ring-emerald-100">
          <Chrome url="app.toflo.co.uk · your pipeline" />
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-emerald-50/50 px-4 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-600 text-[11px] font-semibold text-white">AR</span>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Alex Rivera</p>
              <p className="text-[10px] text-gray-500">Customer Support Specialist · Screening</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              {phase === "report" ? "Report ready" : "Screening finished"}
            </span>
          </div>
          {phase === "writing" ? (
            <div className="flex h-[168px] flex-col items-center justify-center gap-3 p-4">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <Sparkles className="h-4 w-4 animate-pulse text-emerald-600" aria-hidden />
                Toflo is writing the report for your team…
              </span>
              <div className="w-2/3 space-y-2">
                <div className="h-2 animate-pulse rounded-full bg-gray-100" />
                <div className="h-2 animate-pulse rounded-full bg-gray-100" style={{ animationDelay: "150ms" }} />
                <div className="h-2 w-3/4 animate-pulse rounded-full bg-gray-100" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : (
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Recommendation</p>
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700">Proceed to interview</span>
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {[
                  "4 years' customer support experience",
                  "Career gap explained (upskilling course)",
                  "Available for weekend shifts",
                ].map((s) => (
                  <li key={s} className="flex items-start gap-2 text-[13px] text-gray-700">
                    <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
                      <Check className="h-2.5 w-2.5" aria-hidden />
                    </span>
                    {s}
                  </li>
                ))}
                <li className="flex items-start gap-2 text-[13px] text-gray-700">
                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-700">
                    <Search className="h-2.5 w-2.5" aria-hidden />
                  </span>
                  Explore at interview: experience with live-chat tools
                </li>
              </ul>
              <p className="mt-3 border-t border-gray-100 pt-2 text-[10px] text-gray-400">
                Advisory only. Your team always makes the final decision.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
