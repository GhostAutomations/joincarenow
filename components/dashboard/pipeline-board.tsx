"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Phone, Mail, MapPin, CalendarClock, CheckCircle2, AlertTriangle } from "lucide-react";
import { changeStage, getCvUrl, getHireChecklist, type HireChecklistItem } from "@/modules/applications/actions";
import { scheduleInterview, acceptInterviewTime } from "@/modules/interviews/actions";
import { InterviewSlotPicker, type BookedInterview } from "@/components/dashboard/interview-slot-picker";
import { ApplicantComms } from "@/components/dashboard/applicant-comms";
import { ApplicantForms } from "@/components/dashboard/applicant-forms";
import { CvRequest } from "@/components/dashboard/cv-request";
import { createClient } from "@/lib/supabase/client";
import { formatLondon, londonToUtcIso } from "@/lib/time";
import type { OpeningHours } from "@/lib/opening-hours";
import { PageHeader } from "@/components/dashboard/page-header";

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
  branch: string | null;
  worker_category: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
  interview: Interview | null;
  customAnswers: { label: string; value: string }[];
  formAwaiting: number;
  formResent: number;
  formTotal: number;
  transport: string | null;
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
  proposed: "border-blue-400 border-l-4 border-l-blue-500 bg-blue-100",
  confirmed: "border-green-400 border-l-4 border-l-green-600 bg-green-100",
  reschedule_requested: "border-amber-400 border-l-4 border-l-amber-500 bg-amber-100",
  declined: "border-red-400 border-l-4 border-l-red-500 bg-red-100",
};
const IV_TEXT: Record<string, string> = {
  proposed: "text-blue-800",
  confirmed: "text-green-800",
  reschedule_requested: "text-amber-800",
  declined: "text-red-800",
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

/** Compact forms status on a pipeline card:
 *  green tick when every form is complete, an amber count of forms awaiting
 *  review, and a red count of resent forms still outstanding. Completed forms
 *  are not listed individually. Shows nothing if the applicant has no forms. */
function FormBadge({
  awaiting,
  resent,
  total,
}: {
  awaiting: number;
  resent: number;
  total: number;
}) {
  if (total === 0) return null;
  if (awaiting === 0 && resent === 0) {
    return (
      <span
        title="All forms complete"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-sm font-semibold text-green-700"
      >
        <CheckCircle2 className="h-5 w-5" aria-hidden /> Complete
      </span>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {awaiting > 0 && (
        <span
          title={`${awaiting} form${awaiting > 1 ? "s" : ""} awaiting review`}
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-sm font-semibold text-amber-700"
        >
          <AlertTriangle className="h-5 w-5" aria-hidden /> {awaiting}
        </span>
      )}
      {resent > 0 && (
        <span
          title={`${resent} resent form${resent > 1 ? "s" : ""} outstanding`}
          className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-sm font-semibold text-red-700"
        >
          <AlertTriangle className="h-5 w-5" aria-hidden /> {resent}
        </span>
      )}
    </span>
  );
}

export function PipelineBoard({
  initial,
  interviewAddress,
  openId = null,
  companyId,
  openingHours,
  staff = [],
  bookedInterviews = [],
  availableForms = [],
}: {
  initial: AppCard[];
  interviewAddress: string;
  openId?: string | null;
  companyId: string;
  openingHours?: OpeningHours | null;
  staff?: StaffMember[];
  bookedInterviews?: BookedInterview[];
  availableForms?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [selectedId, setSelectedId] = useState<string | null>(openId);
  const [dragId, setDragId] = useState<string | null>(null);
  // Pre-Hire confirmation: holds the applicant pending a Hire confirm.
  const [hireId, setHireId] = useState<string | null>(null);

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
    // Moving into Hired requires a confirmation that reviews the workflow.
    if (stage === "hired" && prevStage !== "hired") {
      setHireId(id);
      return;
    }
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));
    // Moving into Interview opens the card so you can schedule straight away.
    if (stage === "interview" && prevStage !== "interview") setSelectedId(id);
    changeStage(id, stage).then((res) => {
      if (res.error) router.refresh();
    });
  }

  // Confirmed Hire — actually performs the move (bypasses the gate).
  function confirmHire(id: string) {
    setHireId(null);
    setSelectedId(null);
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage: "hired" } : a)));
    changeStage(id, "hired").then((res) => {
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
      <PageHeader title="Pipeline" subtitle="Drag applicants through your hiring stages.">
        <div className="inline-flex rounded-lg border border-white/40 bg-white/15 p-0.5 text-sm">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${
                view === v ? "bg-white text-brand-700" : "text-white/80 hover:bg-white/10"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </PageHeader>

      {apps.length === 0 && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
          No applications yet. When candidates apply through your careers page,
          they&apos;ll appear here.
        </div>
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
                className="rounded-2xl border border-slate-200 bg-slate-100 p-2.5 shadow-sm"
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
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900">{fullName(a)}</p>
                            <p className="mt-0.5 text-xs text-gray-500">{a.job_title}</p>
                          </div>
                          <FormBadge
                            awaiting={a.formAwaiting}
                            resent={a.formResent}
                            total={a.formTotal}
                          />
                        </div>
                        {(a.branch || a.transport) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {a.branch && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                <MapPin className="h-3 w-3" aria-hidden /> {a.branch}
                              </span>
                            )}
                            {a.transport && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {a.transport}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <span>{new Date(a.created_at).toLocaleDateString("en-GB")}</span>
                          {a.cv_path && (
                            <span className="inline-flex items-center gap-1 text-gray-500">
                              <FileText className="h-3 w-3" aria-hidden /> CV
                            </span>
                          )}
                        </div>
                        {a.stage === "interview" && a.interview && (
                          <p className={`mt-2 text-xs font-semibold ${IV_TEXT[a.interview.status] ?? "text-gray-600"}`}>
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
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
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
          availableForms={availableForms}
        />
      )}

      {hireId && (
        <HireConfirm
          applicationId={hireId}
          name={fullName(apps.find((a) => a.id === hireId)!)}
          onCancel={() => setHireId(null)}
          onConfirm={() => confirmHire(hireId)}
        />
      )}
    </div>
  );
}

function HireConfirm({
  applicationId,
  name,
  onCancel,
  onConfirm,
}: {
  applicationId: string;
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [items, setItems] = useState<HireChecklistItem[] | null>(null);
  const [ack, setAck] = useState(false);

  useEffect(() => {
    getHireChecklist(applicationId).then((r) => setItems(r.items));
  }, [applicationId]);

  const outstanding = (items ?? []).filter(
    (i) => i.required && i.status !== "approved"
  );
  const ready = outstanding.length === 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onCancel} />
      <div className="relative flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Move {name} to Hired</h2>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          {items === null ? (
            <p className="text-sm text-gray-400">Checking the workflow…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-gray-600">
              No workflow tasks are set up for this applicant.
            </p>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                Workflow checklist
              </p>
              <ul className="mt-2 space-y-1.5">
                {items.map((i) => {
                  const done = i.status === "approved";
                  return (
                    <li key={i.id} className="flex items-start gap-2 text-sm">
                      {done ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      ) : (
                        <AlertTriangle
                          className={`mt-0.5 h-4 w-4 shrink-0 ${i.required ? "text-amber-500" : "text-gray-300"}`}
                        />
                      )}
                      <span className={done ? "text-gray-700" : "text-gray-900"}>
                        {i.title}
                        {!i.required && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
                        {!done && (
                          <span className="ml-1 text-xs capitalize text-gray-400">— {i.status}</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {items !== null && !ready && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800">
                {outstanding.length} required {outstanding.length === 1 ? "item is" : "items are"} still outstanding.
              </p>
              <label className="mt-2 flex items-start gap-2 text-sm text-amber-900">
                <input
                  type="checkbox"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  className="mt-0.5"
                />
                Hire anyway — I understand these aren&apos;t complete.
              </label>
            </div>
          )}

          {items !== null && ready && (
            <p className="mt-4 text-sm text-gray-600">
              Everything required is complete. Are you sure you want to move {name} to Hired?
              This creates their employee record and sends them to Carer.Academy.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={items === null || (!ready && !ack)}
            className="rounded-lg bg-green-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Yes, move to Hired
          </button>
        </div>
      </div>
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
  availableForms,
}: {
  app: AppCard;
  interviewAddress: string;
  onClose: () => void;
  onStage: (s: string) => void;
  onConfirmInterview: () => void;
  openingHours?: OpeningHours | null;
  staff: StaffMember[];
  bookedInterviews: BookedInterview[];
  availableForms: { id: string; name: string }[];
}) {
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<HireChecklistItem[] | null>(null);

  useEffect(() => {
    getHireChecklist(app.id).then((r) => setTasks(r.items));
  }, [app.id]);

  const forms = (tasks ?? []).filter((t) => t.task_type === "form");

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
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
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

        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-3">
        <div className="space-y-5 overflow-y-auto px-5 py-5 lg:col-span-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Applied for</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{app.job_title}</p>
            <p className="text-xs text-gray-500">
              {new Date(app.created_at).toLocaleDateString("en-GB")}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Branch</p>
                <p className="mt-0.5 flex items-center gap-1 text-sm text-gray-800">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  {app.branch || <span className="text-gray-400">Not set</span>}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-gray-400">Worker type</p>
                <p className="mt-0.5 text-sm text-gray-800">
                  {app.worker_category || <span className="text-gray-400">Not set</span>}
                </p>
              </div>
            </div>
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

          {tasks === null ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">Forms</p>
              <p className="mt-1 text-sm text-gray-400">Loading…</p>
            </div>
          ) : (
            <ApplicantForms
              forms={forms.map((f) => ({ id: f.id, title: f.title, status: f.status }))}
              applicationId={app.id}
              availableForms={availableForms}
            />
          )}

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
            <div>
              <CvRequest applicationId={app.id} />
            </div>
          </div>

        </div>

        {/* Right column: Inbox (messages + composer) */}
        <div className="flex min-h-[50vh] flex-col overflow-hidden border-t border-gray-200 lg:min-h-0 lg:border-l lg:border-t-0">
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
