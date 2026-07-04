"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";

/**
 * Animated Ruby screening demo for the marketing homepage. Decorative only.
 * Act 1 — the candidate's portal: Ruby holds the screening chat. Only things
 * the CANDIDATE would see appear here, arriving at a steady rhythm. Act 2 — the handoff: a staff-view pipeline frame slides
 * in over the chat, first "writing the report", then the finished report —
 * staff-facing states never appear in the candidate's chat. Paced for
 * reading; loops; starts in view; respects prefers-reduced-motion.
 */

type Msg = { from: "ruby" | "candidate"; text: string };

const SCRIPT: Msg[] = [
  { from: "ruby", text: "Hi Megan, I'm Ruby, the recruitment assistant for Bay View Care. Thanks for applying for Care Assistant (Nights). OK if I ask a few quick questions?" },
  { from: "candidate", text: "Yes, no problem." },
  { from: "ruby", text: "I noticed a gap in your work history between March and September last year. Could you tell me a little about that time?" },
  { from: "candidate", text: "I was caring for my mum full time after her stroke." },
  { from: "ruby", text: "Thank you for sharing that. And do you have a car for community visits?" },
  { from: "candidate", text: "Yes, my own car and a clean licence." },
  { from: "ruby", text: "That's everything I need. I'll pass your answers to the team. Good luck!" },
];

// Pacing: no typing indicators (neither side shows one); messages simply
// arrive at a steady, readable rhythm.
const FIRST_MESSAGE_DELAY = 400; // Ruby's opener lands almost immediately
const RUBY_DELAY = 1500;
const CANDIDATE_DELAY = 1500;
const BEFORE_HANDOFF_MS = 1000;
const REPORT_WRITING_MS = 2200;
const REPORT_HOLD_MS = 10000;

function RubyAvatar() {
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-rose-600 to-red-700 text-white shadow-sm">
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
  const ruby = msg.from === "ruby";
  return (
    <div className={`jcn-msg-in flex items-end gap-2 ${ruby ? "" : "flex-row-reverse"}`}>
      {ruby ? (
        <RubyAvatar />
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-500 text-[11px] font-semibold text-white">MH</span>
      )}
      <p
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-snug shadow-sm ${
          ruby ? "rounded-bl-sm bg-gradient-to-br from-rose-600 to-red-700 text-white" : "rounded-br-sm bg-gray-100 text-gray-800"
        }`}
      >
        {msg.text}
      </p>
    </div>
  );
}

export function RubyDemo() {
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
            shown === 0 ? FIRST_MESSAGE_DELAY : next.from === "ruby" ? RUBY_DELAY : CANDIDATE_DELAY
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

  const handoff = phase !== "chat"; // pipeline frame visible (writing or report)

  return (
    <div ref={rootRef} aria-hidden className="relative text-left">
      {/* Act 1 — the candidate's portal chat (candidate-visible content only) */}
      <div
        className={`overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl ring-1 ring-black/5 transition-all duration-700 ${
          handoff ? "scale-[0.98] opacity-50" : "opacity-100"
        }`}
      >
        <Chrome url="joincarenow.com/portal · the candidate's view" />
        <div className="flex items-center gap-2.5 border-b border-gray-100 px-4 py-3">
          <RubyAvatar />
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Ruby · screening chat</p>
            <p className="text-[10px] text-gray-400">With the candidate&apos;s consent</p>
          </div>
        </div>
        <div ref={scrollRef} className="flex h-[480px] flex-col gap-3 overflow-hidden bg-gray-50/60 p-4 sm:p-5">
          {SCRIPT.slice(0, shown).map((m, i) => (
            <Bubble key={i} msg={m} />
          ))}
        </div>
      </div>

      {/* Act 2 — the handoff: YOUR pipeline, writing then report */}
      <div
        className={`absolute inset-x-0 -bottom-6 z-10 mx-auto w-[94%] transition-all duration-700 sm:-bottom-8 sm:w-[88%] ${
          handoff ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0"
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-rose-200 bg-white shadow-2xl ring-1 ring-rose-100">
          <Chrome url="app.joincarenow.com/pipeline · your view" />
          <div className="flex items-center gap-2.5 border-b border-gray-100 bg-rose-50/50 px-4 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-500 text-[11px] font-semibold text-white">MH</span>
            <div>
              <p className="text-[13px] font-semibold text-gray-900">Megan Hughes</p>
              <p className="text-[10px] text-gray-500">Care Assistant (Nights) · Screening</p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-rose-600 to-red-700 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm">
              <Sparkles className="h-3 w-3" aria-hidden />
              {phase === "report" ? "Ruby report ready" : "Screening finished"}
            </span>
          </div>
          {phase === "writing" ? (
            <div className="flex h-[168px] flex-col items-center justify-center gap-3 p-4">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-gray-600">
                <Sparkles className="h-4 w-4 animate-pulse text-rose-600" aria-hidden />
                Ruby is writing her report for your team…
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
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Ruby&apos;s recommendation</p>
                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[10px] font-bold text-green-700">Proceed to interview</span>
              </div>
              <ul className="mt-2.5 space-y-1.5">
                {[
                  "3 years' domiciliary care experience",
                  "Career gap explained (caring for a family member)",
                  "Driver with own car, clean licence",
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
                  Explore at interview: long-term night-shift availability
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
