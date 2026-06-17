"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, AlertTriangle, Clock, Send, Eye, Trash2, Plus, UserPlus } from "lucide-react";
import {
  addReferee,
  sendReferenceRequest,
  reviewReference,
  getReferenceReview,
  deleteReference,
  type ReferenceReview,
} from "@/modules/references/actions";
import { ReferenceReviewModal } from "@/components/dashboard/reference-review-modal";

export type RefRow = {
  id: string;
  referee_name: string;
  referee_email: string;
  referee_employer: string | null;
  relationship: string | null;
  status: string;
};

export type ApplicantGroup = {
  application_id: string;
  applicant_name: string;
  job_title: string;
  refs: RefRow[];
};

const STATUS: Record<string, { label: string; text: string; icon: typeof CheckCircle2; color: string }> = {
  approved: { label: "Approved", text: "text-green-700", icon: CheckCircle2, color: "text-green-600" },
  received: { label: "Received — review", text: "text-amber-600", icon: AlertTriangle, color: "text-amber-500" },
  sent: { label: "Awaiting referee", text: "text-blue-600", icon: Clock, color: "text-blue-500" },
  pending: { label: "Not sent", text: "text-gray-500", icon: Clock, color: "text-gray-400" },
  rejected: { label: "Changes requested", text: "text-red-600", icon: AlertTriangle, color: "text-red-500" },
};

export function ReferencingBoard({
  groups,
  companyId,
}: {
  groups: ApplicantGroup[];
  companyId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<string | null>(null);
  const [modal, setModal] = useState<{ data: ReferenceReview } | null>(null);

  // Live-update when a referee submits (or any reference changes).
  useEffect(() => {
    const supabase = createClient();
    let pending: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel(`referencing-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reference_requests", filter: `company_id=eq.${companyId}` },
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

  async function send(id: string) {
    setBusyId(id);
    const r = await sendReferenceRequest(id);
    setBusyId(null);
    if (r?.error) alert(r.error);
    else router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Remove this referee?")) return;
    await deleteReference(id);
    router.refresh();
  }

  async function open(id: string) {
    setBusyId(id);
    const data = await getReferenceReview(id);
    setBusyId(null);
    if (data) setModal({ data });
  }

  async function doReview(id: string, status: "approved" | "rejected", note?: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    if (note) fd.set("note", note);
    await reviewReference(fd);
    setModal(null);
    router.refresh();
  }

  if (groups.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
        No referees yet. Applicants can add their referees from their portal, or you can add one
        below from the pipeline.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      {groups.map((g) => (
        <div key={g.application_id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-gray-900">{g.applicant_name}</p>
              <p className="text-sm text-gray-500">{g.job_title}</p>
            </div>
            <button
              onClick={() => setAddFor(addFor === g.application_id ? null : g.application_id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <UserPlus className="h-4 w-4" /> Add referee
            </button>
          </div>

          {addFor === g.application_id && (
            <AddRefereeForm
              applicationId={g.application_id}
              onDone={() => {
                setAddFor(null);
                router.refresh();
              }}
            />
          )}

          <ul className="mt-3 divide-y divide-gray-100">
            {g.refs.length === 0 && (
              <li className="py-2 text-sm text-gray-500">No referees added yet.</li>
            )}
            {g.refs.map((r) => {
              const s = STATUS[r.status] ?? STATUS.pending;
              const Icon = s.icon;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Icon className={`h-5 w-5 shrink-0 ${s.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900">{r.referee_name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {r.referee_email}
                      {r.referee_employer ? ` · ${r.referee_employer}` : ""}
                      {r.relationship ? ` · ${r.relationship}` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                  <div className="flex items-center gap-1.5">
                    {(r.status === "pending" || r.status === "sent" || r.status === "rejected") && (
                      <button
                        onClick={() => send(r.id)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        <Send className="h-3.5 w-3.5" /> {r.status === "pending" ? "Send" : "Resend"}
                      </button>
                    )}
                    {(r.status === "received" || r.status === "approved" || r.status === "rejected") && (
                      <button
                        onClick={() => open(r.id)}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    )}
                    <button
                      onClick={() => remove(r.id)}
                      aria-label="Remove referee"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {modal && (
        <ReferenceReviewModal
          data={modal.data}
          onApprove={() => doReview(modal.data.id, "approved")}
          onReject={(note) => doReview(modal.data.id, "rejected", note)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

const input =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function AddRefereeForm({ applicationId, onDone }: { applicationId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    fd.set("applicationId", applicationId);
    const r = await addReferee(fd);
    setBusy(false);
    if (r?.error) setError(r.error);
    else onDone();
  }

  return (
    <form action={action} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Referee name *</span>
        <input name="name" required className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Referee email *</span>
        <input name="email" type="email" required className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Employer / organisation</span>
        <input name="employer" className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Relationship (e.g. former manager)</span>
        <input name="relationship" className={input} />
      </label>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add referee"}
        </button>
      </div>
    </form>
  );
}
