"use client";

import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { respondToInterview } from "@/modules/interviews/actions";
import { DateTimePicker } from "@/components/ui/datetime-picker";

export type PortalInterview = {
  interview_id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
  status: string;
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
  const [mode, setMode] = useState<"none" | "reschedule">("none");
  const when = new Date(interview.scheduled_at).toLocaleString("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
  });

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

      <p className="mt-2 text-xs text-gray-600">{STATUS_TEXT[interview.status]}</p>

      {interview.status === "proposed" && mode === "none" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={respondToInterview}>
            <input type="hidden" name="interviewId" value={interview.interview_id} />
            <input type="hidden" name="response" value="confirmed" />
            <button className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700">
              Confirm
            </button>
          </form>
          <button
            onClick={() => setMode("reschedule")}
            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100"
          >
            Request new time
          </button>
          <form action={respondToInterview}>
            <input type="hidden" name="interviewId" value={interview.interview_id} />
            <input type="hidden" name="response" value="declined" />
            <button className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
              No longer interested
            </button>
          </form>
        </div>
      )}

      {interview.status === "proposed" && mode === "reschedule" && (
        <form action={respondToInterview} className="mt-3 space-y-2">
          <input type="hidden" name="interviewId" value={interview.interview_id} />
          <input type="hidden" name="response" value="reschedule_requested" />
          <div>
            <p className="mb-1 text-xs text-gray-600">When would suit you better?</p>
            <DateTimePicker name="requestedTime" />
          </div>
          <textarea
            name="note"
            rows={2}
            placeholder="Anything else the employer should know? (optional)"
            className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700">
              Send request
            </button>
            <button
              type="button"
              onClick={() => setMode("none")}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
