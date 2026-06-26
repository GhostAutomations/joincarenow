"use client";

import { useState } from "react";
import { CalendarClock, Check, X, Clock } from "lucide-react";
import { respondToInterviewByToken } from "@/modules/interviews/actions";
import { formatLondon } from "@/lib/time";
import { slotsForDate, hasOpeningHours, isoWeekday, DAYS, type OpeningHours } from "@/lib/opening-hours";

export type TokenInterview = {
  token: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
  status: string;
  company_name: string;
  job_title: string | null;
  first_name: string | null;
  opening_hours: OpeningHours;
};

function modeLabel(m: string | null) {
  if (m === "phone") return "Phone call";
  if (m === "video") return "Video call";
  if (m === "in_person") return "In person";
  return null;
}

const DONE_TEXT: Record<string, string> = {
  confirmed: "You've confirmed your interview. See you then!",
  reschedule_requested: "Thanks — we've sent your preferred time to the team. They'll be in touch.",
  declined: "Thanks for letting us know. We've recorded that you're no longer interested.",
};

export function InterviewRespond({ interview }: { interview: TokenInterview }) {
  const [status, setStatus] = useState(interview.status);
  const [view, setView] = useState<"buttons" | "change">("buttons");
  const [requestedTime, setRequestedTime] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [reqSlot, setReqSlot] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // In-person interviews require the applicant to bring proof of Right to Work
  // and to tick that they understand before confirming.
  const needsRtw = interview.mode === "in_person";
  const [rtwAck, setRtwAck] = useState(false);

  const constrained = hasOpeningHours(interview.opening_hours);
  const slots = reqDate ? slotsForDate(interview.opening_hours, reqDate) : [];
  const closedDay = constrained && !!reqDate && slots.length === 0;
  const dayLabel = reqDate ? DAYS.find((d) => d.iso === isoWeekday(reqDate))?.label : "";
  const reqValue = constrained ? (reqDate && reqSlot ? `${reqDate}T${reqSlot}` : "") : requestedTime;
  const todayStr = new Date().toISOString().slice(0, 10);

  const when = formatLondon(interview.scheduled_at);
  const alreadyResponded = ["confirmed", "reschedule_requested", "declined"].includes(status);

  async function respond(response: string, extra?: { requestedTime?: string; note?: string }) {
    setError(null);
    setBusy(true);
    const res = await respondToInterviewByToken(
      interview.token, response, extra?.requestedTime, extra?.note
    );
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setStatus(response);
  }

  return (
    <div className="mx-auto mt-12 max-w-md px-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-brand-700">
          <CalendarClock className="h-5 w-5" />
          <h1 className="text-lg font-semibold text-gray-900">Interview invitation</h1>
        </div>

        <p className="mt-3 text-sm text-gray-600">
          Hi {interview.first_name || "there"}, {interview.company_name} would like to
          interview you{interview.job_title ? ` for the ${interview.job_title} role` : ""}.
        </p>

        <div className="mt-4 rounded-xl bg-gray-50 p-4">
          <p className="text-base font-medium text-gray-900">{when}</p>
          <p className="mt-0.5 text-sm text-gray-600">
            {interview.duration_minutes} minutes
            {modeLabel(interview.mode) ? ` · ${modeLabel(interview.mode)}` : ""}
          </p>
          {interview.location && (
            <p className="mt-1 text-sm text-gray-700">{interview.location}</p>
          )}
          {needsRtw && (
            <p className="mt-2 text-sm font-medium text-amber-700">
              Please bring proof of your Right to Work in the UK (for example your passport, or your
              Home Office share code) to your interview.
            </p>
          )}
        </div>

        {alreadyResponded ? (
          <div className="mt-5 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-800">
            {DONE_TEXT[status] ?? "Your response has been recorded."}
          </div>
        ) : view === "buttons" ? (
          <>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            {needsRtw && (
              <label className="mt-4 flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={rtwAck}
                  onChange={(e) => setRtwAck(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-600"
                />
                <span>I understand I must bring proof of my Right to Work in the UK to the interview.</span>
              </label>
            )}
            <div className="mt-4 space-y-2">
              <button
                onClick={() => respond("confirmed")}
                disabled={busy || (needsRtw && !rtwAck)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> Confirm this time
              </button>
              <button
                onClick={() => setView("change")}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-60"
              >
                <Clock className="h-4 w-4" /> Change the time
              </button>
              <button
                onClick={() => respond("declined")}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
              >
                <X className="h-4 w-4" /> No longer interested
              </button>
            </div>
          </>
        ) : (
          <div className="mt-5 space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="text-sm font-medium text-gray-700">
                When would suit you better?
              </label>
              {constrained ? (
                <>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      min={todayStr}
                      value={reqDate}
                      onChange={(e) => { setReqDate(e.target.value); setReqSlot(""); }}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <select
                      value={reqSlot}
                      onChange={(e) => setReqSlot(e.target.value)}
                      disabled={!reqDate || closedDay}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="">{reqDate ? "Pick a time" : "Pick a date"}</option>
                      {slots.map((s) => (<option key={s} value={s}>{s}</option>))}
                    </select>
                  </div>
                  {closedDay && (
                    <p className="mt-1 text-xs text-amber-600">
                      They&apos;re closed on {dayLabel}. Please pick another day.
                    </p>
                  )}
                </>
              ) : (
                <input
                  type="datetime-local"
                  value={requestedTime}
                  onChange={(e) => setRequestedTime(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Anything else we should know? (optional)"
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={() => respond("reschedule_requested", { requestedTime: reqValue, note })}
                disabled={busy || !reqValue}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Send my preferred time
              </button>
              <button
                onClick={() => setView("buttons")}
                disabled={busy}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-gray-400">Powered by Join Care Now</p>
    </div>
  );
}
