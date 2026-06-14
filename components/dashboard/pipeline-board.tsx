"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Phone, Mail, MapPin, CalendarClock } from "lucide-react";
import { changeStage, getCvUrl } from "@/modules/applications/actions";
import { scheduleInterview } from "@/modules/interviews/actions";

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
};

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

export function PipelineBoard({ initial }: { initial: AppCard[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  // Keep local state in sync when the server data refreshes.
  useEffect(() => setApps(initial), [initial]);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  function move(id: string, stage: string) {
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));
    changeStage(id, stage).then((res) => {
      if (res.error) router.refresh();
    });
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
                className="rounded-xl bg-gray-100/70 p-2"
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
          onClose={() => setSelectedId(null)}
          onStage={(s) => move(selected.id, s)}
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
  onClose,
  onStage,
}: {
  app: AppCard;
  onClose: () => void;
  onStage: (s: string) => void;
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
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
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

        <div className="space-y-5 px-5 py-5">
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

          {app.stage === "interview" && <InterviewSection app={app} />}

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
        </div>
      </aside>
    </div>
  );
}

function InterviewSection({ app }: { app: AppCard }) {
  const router = useRouter();
  const iv = app.interview;
  const [state, action] = useActionState(scheduleInterview, undefined);
  const [editing, setEditing] = useState(!iv);

  useEffect(() => {
    if (state?.ok) {
      setEditing(false);
      router.refresh();
    }
  }, [state, router]);

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
            {new Date(iv.scheduled_at).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
            })}{" "}
            ({iv.duration_minutes} min)
          </p>
          {iv.mode && (
            <p>
              <span className="text-gray-500">Mode:</span> {modeLabel(iv.mode)}
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
          {iv.status === "reschedule_requested" && (
            <div className="rounded-md bg-amber-100 px-3 py-2 text-amber-900">
              <p className="font-medium">Applicant requested a new time</p>
              {iv.requested_time && <p>Preferred: {iv.requested_time}</p>}
              {iv.applicant_note && <p className="mt-0.5">“{iv.applicant_note}”</p>}
            </div>
          )}
          {iv.status === "declined" && iv.applicant_note && (
            <p className="text-red-700">“{iv.applicant_note}”</p>
          )}
          <button
            onClick={() => setEditing(true)}
            className="mt-1 text-sm font-medium text-brand-600 hover:underline"
          >
            {iv.status === "reschedule_requested" ? "Propose new time" : "Reschedule"}
          </button>
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

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">
              Date &amp; time
              <input
                type="datetime-local"
                name="scheduledAt"
                required
                defaultValue={defaultDt}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600">
              Duration (min)
              <input
                type="number"
                name="durationMinutes"
                min={5}
                max={480}
                defaultValue={iv?.duration_minutes ?? 30}
                className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs text-gray-600">
            Mode
            <select
              name="mode"
              defaultValue={iv?.mode ?? "in_person"}
              className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="in_person">In person</option>
              <option value="phone">Phone</option>
              <option value="video">Video call</option>
            </select>
          </label>

          <label className="block text-xs text-gray-600">
            Location / number / link
            <input
              name="location"
              defaultValue={iv?.location ?? ""}
              placeholder="e.g. Head office, or a phone number / video link"
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
                    defaultChecked={(iv?.channel ?? "email") === c}
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
function channelLabel(c: string) {
  return c === "both" ? "Email & SMS" : c === "sms" ? "SMS" : "Email";
}
