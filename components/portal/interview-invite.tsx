"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { respondToInterview } from "@/modules/interviews/actions";
import { DateTimePicker } from "@/components/ui/datetime-picker";
import { formatLondon } from "@/lib/time";
import { buildIcs, calendarLinks, type CalEvent } from "@/lib/calendar/ics";
import type { OpeningHours } from "@/lib/opening-hours";

export type PortalInterview = {
  interview_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
  status: string;
  opening_hours?: OpeningHours | null;
};

const STATUS_TEXT: Record<string, string> = {
  proposed: "Please confirm whether this time works for you.",
  confirmed: "You confirmed this interview. See you then!",
  reschedule_requested: "You asked for a new time. The employer will be in touch.",
  declined: "You let the employer know you're no longer interested.",
};

function modeLabel(m: string | null) {
  if (m === "phone") return "Phone";
  if (m === "video") return "Video call";
  if (m === "in_person") return "In person";
  return null;
}

export function InterviewInvite({ interview }: { interview: PortalInterview }) {
  const [mode, setMode] = useState<"none" | "reschedule" | "cancel">("none");
  const [rtwAck, setRtwAck] = useState(false);
  const needsRtw = interview.mode === "in_person";
  const when = formatLondon(interview.scheduled_at);

  const calEvent: CalEvent = {
    uid: interview.interview_id,
    title: "Job interview",
    startIso: new Date(interview.scheduled_at).toISOString(),
    durationMinutes: interview.duration_minutes,
    location:
      interview.mode === "phone"
        ? "Phone call"
        : interview.mode === "video"
          ? "Video call"
          : interview.location || "In person",
  };
  const calHref = calendarLinks(calEvent);

  function downloadIcs() {
    const blob = new Blob([buildIcs(calEvent)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "interview.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand-700" />
        <p className="text-sm font-medium text-gray-900">Interview invitation</p>
      </div>

      <p className="mt-2 text-sm text-gray-800">{when}</p>
      <p className="text-xs text-gray-600">
        {interview.duration_minutes} minutes
        {modeLabel(interview.mode) ? ` · ${modeLabel(interview.mode)}` : ""}
        {interview.location ? ` · ${interview.location}` : ""}
      </p>

      {needsRtw && (
        <p className="mt-2 text-xs font-medium text-amber-700">
          Please bring proof of your Right to Work in the UK (e.g. passport or Home Office share code) to your interview.
        </p>
      )}

      <p className="mt-2 text-xs text-gray-600">{STATUS_TEXT[interview.status]}</p>

      {(interview.status === "proposed" || interview.status === "confirmed") && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Add to calendar:</span>
          <button
            onClick={downloadIcs}
            className="rounded-lg border border-white/40 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-white/70"
          >
            Apple / iCal
          </button>
          <a
            href={calHref.google}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/40 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-white/70"
          >
            Google
          </a>
          <a
            href={calHref.outlook}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/40 bg-white px-2 py-1 font-medium text-gray-700 hover:bg-white/70"
          >
            Outlook
          </a>
        </div>
      )}

      {(interview.status === "proposed" || interview.status === "confirmed") && mode === "none" && (
        <div className="mt-3 space-y-2">
          {needsRtw && interview.status === "proposed" && (
            <label className="flex items-start gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={rtwAck}
                onChange={(e) => setRtwAck(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/40 text-brand-600"
              />
              <span>I understand I must bring proof of my Right to Work in the UK to the interview.</span>
            </label>
          )}
          <div className="flex flex-wrap gap-2">
          {interview.status === "proposed" && (
            <form action={respondToInterview}>
              <input type="hidden" name="interviewId" value={interview.interview_id} />
              <input type="hidden" name="response" value="confirmed" />
              <button
                disabled={needsRtw && !rtwAck}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Confirm
              </button>
            </form>
          )}
          <button
            onClick={() => setMode("reschedule")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Request new time
          </button>
          <button
            onClick={() => setMode("cancel")}
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100"
          >
            {interview.status === "confirmed" ? "Cancel interview" : "No longer interested"}
          </button>
          </div>
        </div>
      )}

      {(interview.status === "proposed" || interview.status === "confirmed") && mode === "cancel" && (
        <form action={respondToInterview} className="mt-3 space-y-2">
          <input type="hidden" name="interviewId" value={interview.interview_id} />
          <input type="hidden" name="response" value="declined" />
          <p className="text-xs text-gray-600">
            Sorry to hear that. If you&apos;d like, let the employer know why (optional).
          </p>
          <textarea
            name="note"
            rows={2}
            placeholder="Reason (optional)"
            className="block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
              Confirm cancellation
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70"
            >
              Back
            </button>
          </div>
        </form>
      )}

      {(interview.status === "proposed" || interview.status === "confirmed") && mode === "reschedule" && (
        <form action={respondToInterview} className="mt-3 space-y-2">
          <input type="hidden" name="interviewId" value={interview.interview_id} />
          <input type="hidden" name="response" value="reschedule_requested" />
          <div>
            <p className="mb-1 text-xs text-gray-600">When would suit you better?</p>
            <DateTimePicker name="requestedTime" openingHours={interview.opening_hours ?? null} />
          </div>
          <textarea
            name="note"
            rows={2}
            placeholder="Anything else the employer should know? (optional)"
            className="block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
              Send request
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
