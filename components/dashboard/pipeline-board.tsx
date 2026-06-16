"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Phone, Mail, MapPin, CalendarClock } from "lucide-react";
import { changeStage, getCvUrl } from "@/modules/applications/actions";
import { scheduleInterview, acceptInterviewTime } from "@/modules/interviews/actions";
import { InterviewSlotPicker, type BookedInterview } from "@/components/dashboard/interview-slot-picker";
import { ApplicantComms } from "@/components/dashboard/applicant-comms";
import { createClient } from "@/lib/supabase/client";
import { formatLondon, londonToUtcIso } from "@/lib/time";
import type { OpeningHours } from "@/lib/opening-hours";

export type Interview = {
  id: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
  channel: string;
  status: string;
  requested_time: string | null;
  applicant_note: string | null;
  interviewer_id: string | null;
};

export type StaffMember = { user_id: string; name: string };

export type AppCard = {
  id: string;
  stage: string;
  created_at: string;
  cover_message: string | null;
  cv_path: string | null;
  answers: { right_to_work?: boolean } | null;
  job_title: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  interview: Interview | null;
  customAnswers: { label: string; value: string }[];
};

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "applied", label: "Applied", dot: "bg-blue-500" },
  { key: "reviewing", label: "Reviewing", dot: "bg-indigo-500" },
  { key: "interview", label: "Interview", dot: "bg-purple-500" },
  { key: "offer", label: "Offer", dot: "bg-green-500" },
  { key: "hired", label: "Hired", dot: "bg-emerald-600" },
  { key: "rejected", label: "Not progressing", dot: "bg-gray-400" },
];

// Interview response → card colour
const IV_CARD: Record<string, string> = {
  proposed: "border-blue-300 bg-blue-50",
  confirmed: "border-green-300 bg-green-50",
  reschedule_requested: "border-amber-300 bg-amber-50",
  declined: "border-red-300 bg-red-50",
};
const IV_LABEL: Record<string, string> = {
  proposed: "Invite sent — awaiting reply",
  confirmed: "Confirmed",
  reschedule_requested: "New time requested",
  declined: "Declined",
};
const IV_BADGE: Record<string, string> = {
  proposed: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  reschedule_requested: "bg-amber-100 text-amber-800",
  declined: "bg-red-100 text-red-800",
};

function fullName(a: AppCard) {
  return [a.first_name, a.last_name].filter(Boolean).join(" ") || a.email || "Applicant";
}

export function PipelineBoard({
  initial,
  interviewAddress,
  openId = null,
  companyId,
  openingHours,
  staff = [],
  bookedInterviews = [],
}: {
  initial: AppCard[];
  interviewAddress: string;
  openId?: string | null;
  companyId: string;
  openingHours?: OpeningHours | null;
  staff?: StaffMember[];
  bookedInterviews?: BookedInterview[];
}) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [selectedId, setSelectedId] = useState<string | null>(openId);
  const [dragId, setDragId] = useState<string | null>(null);

  // Keep local state in sync when the server data refreshes.
  useEffect(() => setApps(initial), [initial]);

  // Open the requested applicant whenever a notification link points here
  // (works even if we're already on the Pipeline page).
  useEffect(() => {
    if (openId) setSelectedId(openId);
  }, [openId]);

  // Live updates: Supabase pushes any change to this company's applications
  // or interviews and we refresh the board instantly (no polling). A slow
  // 60s poll is kept purely as a safety net if the socket drops.
  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel(`pipeline-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "applications", filter: `company_id=eq.${companyId}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "interviews", filter: `company_id=eq.${companyId}` },
        refresh
      )
      .subscribe();

    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60000);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(t);
      supabase.removeChannel(channel);
    };
  }, [companyId, router]);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  function move(id: string, stage: string) {
    const prevStage = apps.find((a) => a.id === id)?.stage;
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));
    // Moving into Interview opens the card so you can schedule straight away.
    if (stage === "interview" && prevStage !== "interview") setSelectedId(id);
    changeStage(id, stage).then((res) => {
      if (res.error) router.refresh();
    });
  }

  // Instantly flip a card's interview to confirmed (optimistic) before the
  // server round-trip completes.
  function confirmInterviewLocal(id: string) {
    setApps((prev) =>
      prev.map((a) =>
        a.id === id && a.interview
          ? { ...a, interview: { ...a.interview, status: "confirmed" } }
          : a
      )
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${
                view === v ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {apps.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          No applications yet. When candidates apply through your careers page,
          they&apos;ll appear here.
        </p>
      )}

      {apps.length > 0 && view === "board" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((col) => {
            const cards = apps.filter((a) => a.stage === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) move(dragId, col.key);
                  setDragId(null);
                }}
                className="rounded-2xl border border-white/60 bg-white/55 p-2.5 shadow-sm backdrop-blur-sm"
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-medium text-gray-700">{col.label}</span>
                  <span className="ml-auto text-xs text-gray-400">{cards.length}</span>
                </div>
                <div className="space-y-2">
                  {cards.map((a) => {
                    const ivColour =
                      a.stage === "interview" && a.interview
                        ? IV_CARD[a.interview.status]
                        : "";
                    return (
                      <button
                        key={a.id}
                        draggable
                        onDragStart={() => setDragId(a.id)}
                        onClick={() => setSelectedId(a.id)}
                        className={`block w-full cursor-grab rounded-lg border p-3 text-left shadow-sm hover:border-brand-300 active:cursor-grabbing ${
                          ivColour || "border-gray-200 bg-white"
                        }`}
                      >
                        <p className="text-sm font-medium text-gray-900">{fullName(a)}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{a.job_title}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>{new Date(a.created_at).toLocaleDateString("en-GB")}</span>
                          {a.cv_path && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <FileText className="h-3 w-3" aria-hidden /> CV
                            </span>
                          )}
                        </div>
                        {a.stage === "interview" && a.interview && (
                          <p className="mt-2 text-xs font-medium text-gray-600">
                            {IV_LABEL[a.interview.status]}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {apps.length > 0 && view === "table" && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">CV</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedId(a.id)}
                      className="font-medium text-gray-900 hover:text-brand-700"
                    >
                      {fullName(a)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.job_title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(a.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.cv_path ? "Yes" : "—"}</td>
                  <td className="px-4 py-3">
                    <StageSelect value={a.stage} onChange={(s) => move(a.id, s)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ApplicantPanel
          app={selected}
          interviewAddress={interviewAddress}
          onClose={() => setSelectedId(null)}
          onStage={(s) => move(selected.id, s)}
          onConfirmInterview={() => confirmInterviewLocal(selected.id)}
          openingHours={openingHours}
          staff={staff}
          bookedInterviews={bookedInterviews}
        />
      )}
    </div>
  );
}

function StageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function ApplicantPanel({
  app,
  interviewAddress,
  onClose,
  onStage,
  onConfirmInterview,
  openingHours,
  staff,
  bookedInterviews,
}: {
  app: AppCard;
  interviewAddress: string;
  onClose: () => void;
  onStage: (s: string) => void;
  onConfirmInterview: () => void;
  openingHours?: OpeningHours | null;
  staff: StaffMember[];
  bookedInterviews: BookedInterview[];
}) {
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  async function openCv() {
    setCvError(null);
    setCvLoading(true);
    const res = await getCvUrl(app.id);
    setCvLoading(false);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setCvError(res.error ?? "Could not open CV");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — intentionally does NOT close on click. */}
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{fullName(app)}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Applied for</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{app.job_title}</p>
            <p className="text-xs text-gray-500">
              {new Date(app.created_at).toLocaleDateString("en-GB")}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Stage</p>
            <div className="mt-1">
              <StageSelect value={app.stage} onChange={onStage} />
            </div>
          </div>

          {app.stage === "interview" && (
            <InterviewSection
              app={app}
              interviewAddress={interviewAddress}
              onConfirmInterview={onConfirmInterview}
              openingHours={openingHours}
              staff={staff}
              bookedInterviews={bookedInterviews}
              onScheduled={onClose}
            />
          )}

          <div className="space-y-1.5 text-sm text-gray-700">
            {app.email && (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" /> {app.email}
              </p>
            )}
            {app.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" /> {app.phone}
              </p>
            )}
            {app.postcode && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" /> {app.postcode}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Right to work in UK
            </p>
            <p className="mt-0.5 text-sm text-gray-900">
              {app.answers?.right_to_work ? "Confirmed" : "Not confirmed"}
            </p>
          </div>

          {app.cover_message && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Cover message</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {app.cover_message}
              </p>
            </div>
          )}

          {app.customAnswers.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Application answers
              </p>
              <dl className="mt-1 space-y-2">
                {app.customAnswers.map((a, i) => (
                  <div key={i}>
                    <dt className="text-xs text-gray-500">{a.label}</dt>
                    <dd className="text-sm text-gray-800">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">CV</p>
            {app.cv_path ? (
              <button
                onClick={openCv}
                disabled={cvLoading}
                className="mt-1 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {cvLoading ? "Opening…" : "View CV"}
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-gray-500">No CV uploaded.</p>
            )}
            {cvError && <p className="mt-1 text-xs text-red-600">{cvError}</p>}
          </div>

          <div className="border-t border-gray-100 pt-5">
            <ApplicantComms applicationId={app.id} email={app.email} phone={app.phone} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewSection({
  app,
  interviewAddress,
  onConfirmInterview,
  openingHours,
  staff,
  bookedInterviews,
  onScheduled,
}: {
  app: AppCard;
  interviewAddress: string;
  onConfirmInterview: () => void;
  openingHours?: OpeningHours | null;
  staff: StaffMember[];
  bookedInterviews: BookedInterview[];
  onScheduled: () => void;
}) {
  const router = useRouter();
  const iv = app.interview;
  const [state, action] = useActionState(scheduleInterview, undefined);
  const [editing, setEditing] = useState(!iv);
  const [accepting, setAccepting] = useState(false);
  const [interviewerId, setInterviewerId] = useState(iv?.interviewer_id ?? "");
  const [channel, setChannel] = useState(iv?.channel ?? "email");

  async function accept() {
    setAccepting(true);
    onConfirmInterview(); // optimistic: card flips green immediately
    const res = await acceptInterviewTime(app.id);
    setAccepting(false);
    router.refresh(); // reconcile with server (also reverts if it failed)
  }

  // Type (in person / phone / video) + location, so "in person" can
  // pre-fill the company's saved interview address.
  const [type, setType] = useState(iv?.mode ?? "in_person");
  const [location, setLocation] = useState(
    iv ? (iv.location ?? "") : type === "in_person" ? interviewAddress : ""
  );

  function onTypeChange(next: string) {
    setType(next);
    if (next === "in_person" && !location.trim()) setLocation(interviewAddress);
    if (next !== "in_person" && location === interviewAddress) setLocation("");
  }

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
      onScheduled(); // close the modal once the interview is scheduled
    }
  }, [state, router, onScheduled]);

  const defaultDt = iv ? toLocalInput(iv.scheduled_at) : "";

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-gray-500" />
        <p className="text-sm font-medium text-gray-900">Interview</p>
        {iv && (
          <span
            className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              IV_BADGE[iv.status] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {IV_LABEL[iv.status]}
          </span>
        )}
      </div>

      {iv && !editing && (
        <div className="mt-3 space-y-1.5 text-sm text-gray-700">
          <p>
            <span className="text-gray-500">When:</span>{" "}
            {formatLondon(iv.scheduled_at, { dateStyle: "medium", timeStyle: "short" })}{" "}
            ({iv.duration_minutes} min)
          </p>
          {iv.mode && (
            <p>
              <span className="text-gray-500">Type:</span> {modeLabel(iv.mode)}
            </p>
          )}
          {iv.location && (
            <p>
              <span className="text-gray-500">Where:</span> {iv.location}
            </p>
          )}
          <p>
            <span className="text-gray-500">Invite via:</span>{" "}
            {channelLabel(iv.channel)}
          </p>
          {iv.interviewer_id && (
            <p>
              <span className="text-gray-500">With:</span>{" "}
              {staff.find((s) => s.user_id === iv.interviewer_id)?.name ?? "Team member"}
            </p>
          )}
          {iv.status === "reschedule_requested" && (
            <div className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">
              <p className="font-medium">Applicant requested a new time</p>
              {iv.requested_time && (
                <p>Preferred: {formatRequested(iv.requested_time)}</p>
              )}
              {iv.applicant_note && <p className="mt-0.5">“{iv.applicant_note}”</p>}
            </div>
          )}
          {iv.status === "declined" && iv.applicant_note && (
            <p className="text-red-700">“{iv.applicant_note}”</p>
          )}

          {iv.status === "reschedule_requested" && iv.requested_time ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                onClick={accept}
                disabled={accepting}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                {accepting ? "Confirming…" : `Accept ${formatRequested(iv.requested_time)}`}
              </button>
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Propose new time
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="mt-1 text-sm font-medium text-brand-600 hover:underline"
            >
              Reschedule
            </button>
          )}
        </div>
      )}

      {editing && (
        <form action={action} className="mt-3 space-y-3">
          {state?.error && (
            <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
              {state.error}
            </p>
          )}
          <input type="hidden" name="applicationId" value={app.id} />

          <label className="block text-xs text-gray-600">
            Interview with
            <select
              name="interviewerId"
              value={interviewerId}
              onChange={(e) => setInterviewerId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Choose a team member…</option>
              {staff.map((s) => (
                <option key={s.user_id} value={s.user_id}>{s.name}</option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <p className="text-xs text-gray-600">Pick a slot</p>
            {interviewerId ? (
              <InterviewSlotPicker
                name="scheduledAt"
                openingHours={openingHours ?? {}}
                interviews={bookedInterviews}
                interviewerId={interviewerId}
                defaultValue={defaultDt}
              />
            ) : (
              <p className="rounded-md border border-dashed border-gray-300 px-3 py-2 text-xs text-gray-500">
                Choose who the interview is with above to see their availability.
              </p>
            )}
          </div>

          <label className="block text-xs text-gray-600">
            Duration
            <select
              name="durationMinutes"
              defaultValue={String(iv?.duration_minutes ?? 30)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {[15, 30, 45, 60, 75, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m >= 60
                    ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`
                    : `${m} min`}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs text-gray-600">
            Type
            <select
              name="mode"
              value={type}
              onChange={(e) => onTypeChange(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="in_person">In person</option>
              <option value="phone">Phone</option>
              <option value="video">Video call</option>
            </select>
          </label>

          <label className="block text-xs text-gray-600">
            {type === "in_person"
              ? "Address"
              : type === "phone"
                ? "Phone number"
                : "Video link"}
            <input
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={
                type === "in_person"
                  ? "Interview address"
                  : type === "phone"
                    ? "Phone number to call"
                    : "Video meeting link"
              }
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>

          <fieldset>
            <legend className="text-xs text-gray-600">Send invite by</legend>
            <div className="mt-1 flex gap-4 text-sm">
              {(["email", "sms", "both"] as const).map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="channel"
                    value={c}
                    checked={channel === c}
                    onChange={() => setChannel(c)}
                  />
                  {channelLabel(c)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              {iv ? "Update & resend invite" : "Send interview invite"}
            </button>
            {iv && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            Sending by SMS/email goes live with the Communication phase — for now
            the applicant sees and responds to the invite in their portal.
          </p>
        </form>
      )}
    </div>
  );
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function modeLabel(m: string) {
  return m === "in_person" ? "In person" : m === "phone" ? "Phone" : "Video call";
}
function formatRequested(v: string) {
  try {
    return formatLondon(londonToUtcIso(v), { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return v;
  }
}
function channelLabel(c: string) {
  return c === "both" ? "Email & SMS" : c === "sms" ? "SMS" : "Email";
}
