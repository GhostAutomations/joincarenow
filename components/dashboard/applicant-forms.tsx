"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Send } from "lucide-react";
import {
  reviewTask,
  reviewApplicationForm,
  getFormReview,
  getApplicationReview,
  sendAdHocForm,
  type FormReview,
} from "@/modules/onboarding/actions";
import { FormReviewModal } from "@/components/dashboard/form-review-modal";

export type FormItem = {
  id: string;
  title: string;
  status: string; // pending | submitted | approved | rejected
};

const STATUS: Record<
  string,
  { label: string; text: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  approved: { label: "Complete", text: "text-green-700", icon: CheckCircle2, iconColor: "text-green-600" },
  submitted: { label: "Submitted", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-amber-500" },
  rejected: { label: "Resent", text: "text-red-600", icon: AlertTriangle, iconColor: "text-red-500" },
  pending: { label: "Outstanding", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-amber-500" },
};

type Modal = {
  data: FormReview;
  onApprove: () => Promise<void>;
  onResend: (note: string) => Promise<void>;
};

export function ApplicantForms({
  forms,
  applicationId,
  availableForms = [],
}: {
  forms: FormItem[];
  applicationId: string;
  availableForms?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(forms);
  const [appReview, setAppReview] = useState<(FormReview & { submissionId: string | null }) | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [sendId, setSendId] = useState("");
  const [sending, setSending] = useState(false);
  const [notify, setNotify] = useState<"email" | "sms" | "both" | "none">("email");

  // Re-sync only when the actual form id/status content changes — not on every
  // render. (A plain [forms] dependency changes identity each render and would
  // clobber an optimistic "approved" back to the stale "submitted".)
  const formsSig = forms.map((f) => `${f.id}:${f.status}`).join("|");
  useEffect(() => {
    setItems(forms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formsSig]);

  useEffect(() => {
    getApplicationReview(applicationId).then(setAppReview);
  }, [applicationId]);

  // The application form has its own dedicated row; if a resend created a portal
  // task for it (title "Application form"), don't list it twice.
  const workflowItems = items.filter(
    (f) => f.title.trim().toLowerCase() !== "application form"
  );
  const done = workflowItems.filter((f) => f.status === "approved").length;

  // Forms the recruiter can still send (not already on this applicant).
  const sentTitles = new Set(items.map((f) => f.title.trim().toLowerCase()));
  const sendableForms = availableForms.filter(
    (f) => !sentTitles.has(f.name.trim().toLowerCase())
  );

  async function doReviewTask(taskId: string, status: "approved" | "rejected", note?: string) {
    const fd = new FormData();
    fd.set("id", taskId);
    fd.set("status", status);
    if (note) fd.set("note", note);
    await reviewTask(fd);
    setItems((prev) => prev.map((f) => (f.id === taskId ? { ...f, status } : f)));
    setModal(null);
    router.refresh();
  }

  async function doReviewApp(status: "approved" | "rejected", note?: string) {
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("status", status);
    if (note) fd.set("note", note);
    await reviewApplicationForm(fd);
    setAppReview((prev) => (prev ? { ...prev, status } : prev));
    setModal(null);
    router.refresh();
  }

  async function openTask(taskId: string) {
    setLoadingId(taskId);
    const data = await getFormReview(taskId);
    setLoadingId(null);
    if (!data) return;
    setModal({
      data,
      onApprove: () => doReviewTask(taskId, "approved"),
      onResend: (note) => doReviewTask(taskId, "rejected", note),
    });
  }

  async function send() {
    if (!sendId) return;
    setSending(true);
    const r = await sendAdHocForm(applicationId, sendId, notify === "none" ? null : notify);
    setSending(false);
    if (r?.error) {
      alert(r.error);
      return;
    }
    if (r?.notifyError) alert(`Form sent, but the notification didn't go: ${r.notifyError}`);
    setSendId("");
    router.refresh();
  }

  function openApp() {
    if (!appReview) return;
    setModal({
      data: appReview,
      onApprove: () => doReviewApp("approved"),
      onResend: (note) => doReviewApp("rejected", note),
    });
  }

  const hasAppForm = appReview && appReview.fields.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-gray-400">Forms</p>
        {workflowItems.length > 0 && (
          <span className="text-xs text-gray-500">{done}/{workflowItems.length} approved</span>
        )}
      </div>

      <ul className="mt-1.5 grid grid-cols-1 gap-x-3 gap-y-0.5 sm:grid-cols-2">
        {/* Application form */}
        {hasAppForm && (
          <Row
            title="Application form"
            status={appReview!.status}
            onOpen={openApp}
            loading={false}
          />
        )}

        {/* Workflow form tasks */}
        {workflowItems.map((f) => (
          <Row
            key={f.id}
            title={f.title}
            status={f.status}
            onOpen={() => openTask(f.id)}
            loading={loadingId === f.id}
          />
        ))}

        {workflowItems.length === 0 && !hasAppForm && (
          <li className="text-sm text-gray-500">No forms assigned.</li>
        )}
      </ul>

      {/* Ad-hoc: send another form to this applicant. */}
      {sendableForms.length > 0 && (
        <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
          <select
            value={sendId}
            onChange={(e) => setSendId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">Send a form…</option>
            {sendableForms.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <select
            value={notify}
            onChange={(e) => setNotify(e.target.value as "email" | "sms" | "both" | "none")}
            title="Notify the applicant"
            className="shrink-0 rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="both">Email &amp; SMS</option>
            <option value="none">No notice</option>
          </select>
          <button
            onClick={send}
            disabled={!sendId || sending}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send"}
          </button>
        </div>
      )}

      {modal && (
        <FormReviewModal
          data={modal.data}
          onApprove={modal.onApprove}
          onResend={modal.onResend}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function Row({
  title,
  status,
  onOpen,
  loading,
}: {
  title: string;
  status: string;
  onOpen: () => void;
  loading: boolean;
}) {
  const s = STATUS[status] ?? STATUS.pending;
  const Icon = s.icon;
  return (
    <li>
      <button
        onClick={onOpen}
        disabled={loading}
        className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-gray-50 disabled:opacity-60"
      >
        <Icon className={`h-4 w-4 shrink-0 ${s.iconColor}`} />
        <span className="text-brand-700 underline-offset-2 hover:underline">{title}</span>
        <span className={`ml-auto text-xs ${s.text}`}>{loading ? "Opening…" : s.label}</span>
      </button>
    </li>
  );
}
