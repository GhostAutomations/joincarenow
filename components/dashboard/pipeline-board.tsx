"use client";

import { useState, useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Phone, Mail, MapPin, CalendarClock, CheckCircle2, AlertTriangle, XCircle, Minus, Car, PersonStanding } from "lucide-react";
import { changeStage, getCvUrl, getHireChecklist, type HireChecklistItem } from "@/modules/applications/actions";
import { scheduleInterview, acceptInterviewTime } from "@/modules/interviews/actions";
import { InterviewSlotPicker, type BookedInterview } from "@/components/dashboard/interview-slot-picker";
import { ApplicantComms } from "@/components/dashboard/applicant-comms";
import { ApplicantForms } from "@/components/dashboard/applicant-forms";
import { ApplicantReferences } from "@/components/dashboard/applicant-references";
import { ApplicantPoppyReport } from "@/components/dashboard/applicant-poppy-report";
import { ApplicantTeamMessages } from "@/components/dashboard/applicant-team-messages";
import { CvRequest } from "@/components/dashboard/cv-request";
import { DocRequest } from "@/components/dashboard/doc-request";
import { getOnboardingDocUrl } from "@/modules/onboarding/actions";
import { RightToWork } from "@/components/dashboard/right-to-work";
import { OfferModal } from "@/components/dashboard/offer-modal";
import { RejectModal } from "@/components/dashboard/reject-modal";
import { getOffer, type OfferInfo } from "@/modules/offers/actions";
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
  rtwVerifiedAt: string | null;
  rtwShareCode: string | null;
  rtwExpiry: string | null;
  rtwHasDoc: boolean;
  refsState: string | null;
  refsTotal: number;
  offerStatus: string | null;
  salary: string | null;
};

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "applied", label: "Applied", dot: "bg-blue-500" },
  { key: "reviewing", label: "Reviewing", dot: "bg-indigo-500" },
  { key: "interview", label: "Interview", dot: "bg-purple-500" },
  { key: "right_to_work", label: "Right to work", dot: "bg-amber-500" },
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

/** Number of days until a date (negative if in the past). */
function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

/** Hover tooltip, same idea as the dock icons. */
function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-7 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-1.5 py-1 text-[10px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}

type StatusKind = "ok" | "warn" | "bad" | "none";
function StatusIcon({ kind, label }: { kind: StatusKind; label: string }) {
  const Icon = kind === "ok" ? CheckCircle2 : kind === "bad" ? XCircle : kind === "warn" ? AlertTriangle : Minus;
  const cls =
    kind === "ok" ? "text-green-600" : kind === "bad" ? "text-red-600" : kind === "warn" ? "text-amber-500" : "text-gray-300";
  return (
    <Tip label={label}>
      <Icon className={`h-3.5 w-3.5 ${cls}`} aria-hidden />
    </Tip>
  );
}

function formsStatus(a: AppCard): { kind: StatusKind; label: string } {
  if (a.formTotal === 0) return { kind: "none", label: "No forms sent" };
  if (a.formResent > 0) return { kind: "bad", label: `${a.formResent} form(s) need redoing` };
  if (a.formAwaiting > 0) return { kind: "warn", label: `${a.formAwaiting} form(s) awaiting review` };
  return { kind: "ok", label: "All forms complete" };
}
function refsStatus(a: AppCard): { kind: StatusKind; label: string } {
  if (!a.refsState || a.refsTotal === 0) return { kind: "none", label: "No references yet" };
  if (a.refsState === "approved") return { kind: "ok", label: "References complete" };
  if (a.refsState === "rejected") return { kind: "bad", label: "Reference: more info needed" };
  return { kind: "warn", label: "References in progress" };
}
function rtwStatus(a: AppCard): { kind: StatusKind; label: string } {
  if (!a.rtwVerifiedAt) return { kind: "warn", label: "Right to work awaiting" };
  const d = a.rtwExpiry ? daysUntil(a.rtwExpiry) : null;
  if (d !== null && d < 0) return { kind: "bad", label: "Right to work expired" };
  if (d !== null && d <= 30) return { kind: "warn", label: `Right to work expires in ${d}d` };
  return { kind: "ok", label: "Right to work confirmed" };
}

/** One column of the card status strip. */
function StatusCol({
  title,
  icon: Icon,
  children,
}: {
  title?: string;
  icon?: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 py-1">
      <span className="text-[9px] font-semibold text-gray-600">
        {Icon ? <Icon className="h-2.5 w-2.5" aria-hidden /> : title}
      </span>
      <span className="flex h-3.5 w-full min-w-0 items-center justify-center overflow-hidden">{children}</span>
    </div>
  );
}

/** Five-column status strip on a pipeline card: Forms · Refs · RTW · Location · Travel. */
function CardStatusRow({ a }: { a: AppCard }) {
  const f = formsStatus(a);
  const r = refsStatus(a);
  const w = rtwStatus(a);
  const t = a.transport?.toLowerCase();
  return (
    <div className="mt-1.5 grid grid-cols-5 divide-x divide-gray-200 rounded-lg border border-gray-200">
      <StatusCol title="Forms">
        <StatusIcon kind={f.kind} label={f.label} />
      </StatusCol>
      <StatusCol title="Refs">
        <StatusIcon kind={r.kind} label={r.label} />
      </StatusCol>
      <StatusCol title="RTW">
        <StatusIcon kind={w.kind} label={w.label} />
      </StatusCol>
      <StatusCol icon={MapPin}>
        <span className="block w-full truncate px-0.5 text-center text-[9px] text-gray-700">
          {a.branch || <span className="text-gray-300">—</span>}
        </span>
      </StatusCol>
      <StatusCol title="Travel">
        {t === "driver" ? (
          <Tip label="Driver"><Car className="h-3.5 w-3.5 text-gray-600" aria-hidden /></Tip>
        ) : t === "walker" ? (
          <Tip label="Walker"><PersonStanding className="h-3.5 w-3.5 text-gray-600" aria-hidden /></Tip>
        ) : (
          <Tip label="Transport not set"><Minus className="h-3.5 w-3.5 text-gray-300" aria-hidden /></Tip>
        )}
      </StatusCol>
    </div>
  );
}

/** Compact labelled fact used in the applicant pop-up's top info grid. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm text-gray-800">{children}</p>
    </div>
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
  channelSuffix = "",
  hideHeader = false,
}: {
  initial: AppCard[];
  interviewAddress: string;
  openId?: string | null;
  companyId: string;
  openingHours?: OpeningHours | null;
  staff?: StaffMember[];
  bookedInterviews?: BookedInterview[];
  availableForms?: { id: string; name: string }[];
  channelSuffix?: string;
  hideHeader?: boolean;
}) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [view] = useState<"board" | "table">("board");
  const [selectedId, setSelectedId] = useState<string | null>(openId);
  const [dragId, setDragId] = useState<string | null>(null);
  // Pre-Hire confirmation: holds the applicant pending a Hire confirm.
  const [hireId, setHireId] = useState<string | null>(null);
  // Make-an-offer popup: holds the applicant being offered.
  const [offerId, setOfferId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);

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
    // No server-side filter — RLS already scopes events to this company's rows,
    // and unfiltered postgres_changes subscriptions deliver far more reliably
    // than filtered ones (the filtered version was missing the offer-accept push).
    const channel = supabase
      .channel(`pipeline-${companyId}${channelSuffix ? `-${channelSuffix}` : ""}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "interviews" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "offers" }, refresh)
      .subscribe();

    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 60000);

    // Background tabs are throttled, so realtime can lag while the board isn't
    // focused — refresh immediately when the recruiter returns to the tab.
    const onVisible = () => {
      if (!document.hidden) router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      if (pending) clearTimeout(pending);
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
      supabase.removeChannel(channel);
    };
  }, [companyId, router, channelSuffix]);

  const selected = apps.find((a) => a.id === selectedId) ?? null;

  function move(id: string, stage: string) {
    const prevStage = apps.find((a) => a.id === id)?.stage;
    // Moving into Hired requires a confirmation that reviews the workflow.
    if (stage === "hired" && prevStage !== "hired") {
      setHireId(id);
      return;
    }
    // Moving into Not Progressing opens the rejection popup (the send sets the stage).
    if (stage === "rejected" && prevStage !== "rejected") {
      setRejectId(id);
      return;
    }
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));
    // Moving into Interview or Right to work opens the card so you can act straight away.
    if (
      (stage === "interview" || stage === "right_to_work") &&
      prevStage !== stage
    )
      setSelectedId(id);
    // Moving into Offer opens the make-an-offer popup.
    if (stage === "offer" && prevStage !== "offer") setOfferId(id);
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
      {!hideHeader && (
        <PageHeader title="Pipeline" subtitle="Drag applicants through your hiring stages." />
      )}

      {apps.length === 0 && (
        <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-500 shadow-sm">
          No applications yet. When candidates apply through your careers page,
          they&apos;ll appear here.
        </div>
      )}

      {apps.length > 0 && view === "board" && (
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
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
                        <p className="text-xs font-medium text-gray-900">
                          {fullName(a)}
                          <span className="font-normal text-gray-500"> · {a.job_title}</span>
                        </p>
                        <CardStatusRow a={a} />
                        {a.stage === "interview" && a.interview && (
                          <p className={`mt-2 text-xs font-semibold ${IV_TEXT[a.interview.status] ?? "text-gray-600"}`}>
                            {IV_LABEL[a.interview.status]}
                          </p>
                        )}
                        {a.stage === "offer" && a.offerStatus && (
                          <p
                            className={`mt-2 text-xs font-semibold ${
                              a.offerStatus === "accepted"
                                ? "text-green-600"
                                : a.offerStatus === "declined"
                                ? "text-red-600"
                                : "text-blue-600"
                            }`}
                          >
                            {a.offerStatus === "accepted"
                              ? "Offer accepted"
                              : a.offerStatus === "declined"
                              ? "Offer declined"
                              : "Offer sent — awaiting reply"}
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
        <div className="mt-6 overflow-hidden rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
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
                <tr key={a.id} className="hover:bg-white/60">
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
          onSendOffer={() => setOfferId(selected.id)}
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

      {offerId && (
        <OfferModal
          applicationId={offerId}
          defaultRole={apps.find((a) => a.id === offerId)?.job_title ?? ""}
          defaultPay={apps.find((a) => a.id === offerId)?.salary ?? ""}
          onClose={() => setOfferId(null)}
        />
      )}

      {rejectId && (
        <RejectModal applicationId={rejectId} onClose={() => setRejectId(null)} />
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
            className="rounded-lg border border-white/40 bg-white/60 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70"
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
      className="rounded-lg border border-white/40 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
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
  onSendOffer,
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
  onSendOffer: () => void;
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
  // Requested documents (DBS, etc.) — CV has its own section above.
  const documents = (tasks ?? []).filter((t) => t.task_type === "document" && !t.is_cv);

  async function openCv() {
    setCvError(null);
    setCvLoading(true);
    const res = await getCvUrl(app.id);
    setCvLoading(false);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setCvError(res.error ?? "Could not open CV");
  }

  const [docErr, setDocErr] = useState<string | null>(null);
  const [docBusy, setDocBusy] = useState<string | null>(null);
  async function openDoc(taskId: string) {
    setDocErr(null);
    setDocBusy(taskId);
    const res = await getOnboardingDocUrl(taskId);
    setDocBusy(null);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setDocErr(res.error ?? "Could not open the document");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop — intentionally does NOT close on click. */}
      <div className="absolute inset-0 bg-black/40" aria-hidden />
      <div className="relative flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{fullName(app)}</h2>
          <div className="flex items-center gap-3">
            <div className="w-40 sm:w-48">
              <StageSelect value={app.stage} onChange={onStage} />
            </div>
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 hover:bg-white/70 hover:text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-3 lg:overflow-hidden">
        <div className="space-y-4 px-5 py-5 lg:col-span-2 lg:overflow-y-auto">
          {/* Key facts + contact — 4 columns, each stacking two facts.
             Row order gives: [Applied for/Date] [Branch/Worker type]
             [Phone/Email] [Postcode/Right to work]. */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-xl border border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-4">
            <Fact label="Applied for">
              <span className="font-medium text-gray-900">{app.job_title}</span>
            </Fact>
            <Fact label="Branch">{app.branch || <span className="text-gray-400">Not set</span>}</Fact>
            <Fact label="Phone">{app.phone || <span className="text-gray-400">—</span>}</Fact>
            <Fact label="Postcode">{app.postcode || <span className="text-gray-400">—</span>}</Fact>

            <Fact label="Date">{new Date(app.created_at).toLocaleDateString("en-GB")}</Fact>
            <Fact label="Worker type">{app.worker_category || <span className="text-gray-400">Not set</span>}</Fact>
            <Fact label="Email">
              <span className="block truncate">{app.email || <span className="text-gray-400">—</span>}</span>
            </Fact>
            <Fact label="Right to work">
              {app.rtwVerifiedAt ? (
                <span className="font-medium text-green-600">Confirmed</span>
              ) : (
                <span className="font-medium text-amber-600">Awaiting</span>
              )}
            </Fact>
          </div>

          {/* Stage-specific action sits at the top so it's front-and-centre
             when you drop someone into Interview / Right to work / Offer. */}
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

          {app.stage === "right_to_work" && (
            <RightToWork
              applicationId={app.id}
              rtw={{
                verifiedAt: app.rtwVerifiedAt,
                shareCode: app.rtwShareCode,
                expiry: app.rtwExpiry,
                hasDoc: app.rtwHasDoc,
              }}
            />
          )}

          {app.stage === "offer" && <OfferSection applicationId={app.id} onSend={onSendOffer} />}

          {/* Forms */}
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

          {/* References */}
          <ApplicantReferences applicationId={app.id} />

          {/* Poppy — workflow screening report, else on-demand interview questions */}
          <ApplicantPoppyReport
            applicationId={app.id}
            applicantName={[app.first_name, app.last_name].filter(Boolean).join(" ") || "Applicant"}
          />

          {/* Internal team messages tagged to this applicant (staff-only) */}
          <ApplicantTeamMessages applicationId={app.id} />

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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {app.cv_path ? (
                <button
                  onClick={openCv}
                  disabled={cvLoading}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  <FileText className="h-4 w-4" />
                  {cvLoading ? "Opening…" : "View CV"}
                </button>
              ) : (
                <span className="text-sm text-gray-500">No CV uploaded.</span>
              )}
              <CvRequest applicationId={app.id} />
            </div>
            {cvError && <p className="mt-1 text-xs text-red-600">{cvError}</p>}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Documents</p>
            {documents.length > 0 && (
              <ul className="mt-1 divide-y divide-gray-100">
                {documents.map((d) => {
                  const submitted = d.status === "submitted" || d.status === "approved";
                  return (
                    <li key={d.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                      <span className="min-w-0 truncate text-gray-700">{d.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : d.status === "submitted"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {d.status === "approved" ? "Approved" : d.status === "submitted" ? "Uploaded" : "Awaiting upload"}
                        </span>
                        {submitted && (
                          <button
                            onClick={() => openDoc(d.id)}
                            disabled={docBusy === d.id}
                            className="rounded-lg border border-white/40 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-white/70 disabled:opacity-60"
                          >
                            {docBusy === d.id ? "Opening…" : "View"}
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DocRequest
                applicationId={app.id}
                docTitle="Upload your DBS certificate"
                docKind="dbs"
                buttonLabel="Request DBS certificate"
                sentLabel="DBS requested"
                placeholder="e.g. Please upload a clear copy of your DBS certificate."
              />
            </div>
            {docErr && <p className="mt-1 text-xs text-red-600">{docErr}</p>}
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

/** Offer status + send/resend, shown in the panel when the applicant is at Offer. */
function OfferSection({ applicationId, onSend }: { applicationId: string; onSend: () => void }) {
  const [offer, setOffer] = useState<OfferInfo | null | "loading">("loading");
  useEffect(() => {
    getOffer(applicationId).then((o) => setOffer(o));
  }, [applicationId]);

  const STATUS: Record<string, { label: string; cls: string }> = {
    sent: { label: "Sent — awaiting reply", cls: "text-blue-600" },
    accepted: { label: "Accepted", cls: "text-green-600" },
    declined: { label: "Declined", cls: "text-red-600" },
  };

  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400">Offer</p>
      {offer === "loading" ? (
        <p className="mt-1 text-sm text-gray-400">Loading…</p>
      ) : !offer ? (
        <div className="mt-1.5">
          <p className="text-sm text-gray-600">No offer sent yet.</p>
          <button
            onClick={onSend}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Make an offer
          </button>
        </div>
      ) : (
        <div className="mt-1.5 rounded-xl border border-gray-200 bg-gray-50/60 p-3 text-sm text-gray-700">
          <p className={`font-medium ${STATUS[offer.status]?.cls ?? "text-gray-700"}`}>
            Offer {STATUS[offer.status]?.label ?? offer.status}
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            {offer.role && <p><span className="text-gray-400">Role</span><br />{offer.role}</p>}
            {offer.startDate && <p><span className="text-gray-400">Start</span><br />{new Date(offer.startDate).toLocaleDateString("en-GB")}</p>}
            {offer.pay && <p><span className="text-gray-400">Pay</span><br />{offer.pay}</p>}
            {offer.hours && <p><span className="text-gray-400">Hours</span><br />{offer.hours}</p>}
          </div>
          {offer.conditional && offer.conditions && (
            <p className="mt-1.5 text-xs text-gray-600"><span className="text-gray-400">Conditions:</span> {offer.conditions}</p>
          )}
          {offer.status === "declined" && offer.declineReason && (
            <p className="mt-1.5 text-xs text-gray-600"><span className="text-gray-400">Reason given:</span> {offer.declineReason}</p>
          )}
          {offer.status === "declined" && (
            <p className="mt-1.5 text-xs text-gray-600">
              <span className="text-gray-400">Talent pool:</span>{" "}
              {offer.talentPool ? (
                <span className="text-green-700">
                  Opted in
                  {offer.talentPoolConsentAt && (() => {
                    const expiry = new Date(offer.talentPoolConsentAt);
                    expiry.setMonth(expiry.getMonth() + 6);
                    return ` — kept until ${expiry.toLocaleDateString("en-GB")}`;
                  })()}
                </span>
              ) : (
                <span className="text-gray-500">Declined to join</span>
              )}
            </p>
          )}
          <button
            onClick={onSend}
            className="mt-2 rounded-lg border border-white/40 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white/70"
          >
            {offer.status === "sent" ? "Resend / edit offer" : "Reissue offer"}
          </button>
          {offer.status === "accepted" && (
            <p className="mt-1.5 text-xs text-gray-500">
              Reissuing replaces the accepted offer with a fresh one (e.g. corrected pay or contract) and asks the applicant to accept again.
            </p>
          )}
        </div>
      )}
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
                className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/70"
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
              className="mt-1 block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
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
              <p className="rounded-md border border-dashed border-white/40 px-3 py-2 text-xs text-gray-500">
                Choose who the interview is with above to see their availability.
              </p>
            )}
          </div>

          <label className="block text-xs text-gray-600">
            Duration
            <select
              name="durationMinutes"
              defaultValue={String(iv?.duration_minutes ?? 30)}
              className="mt-1 block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
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
              className="mt-1 block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
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
              className="mt-1 block w-full rounded-md border border-white/40 px-2 py-1.5 text-sm"
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
                className="rounded-lg border border-white/40 px-3 py-1.5 text-sm text-gray-700 hover:bg-white/70"
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
