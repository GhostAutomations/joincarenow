"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import {
  reviewTask,
  reviewApplicationForm,
  getFormReview,
  getApplicationReview,
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
}: {
  forms: FormItem[];
  applicationId: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(forms);
  const [appReview, setAppReview] = useState<(FormReview & { submissionId: string | null }) | null>(null);
  const [modal, setModal] = useState<Modal | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    getApplicationReview(applicationId).then(setAppReview);
  }, [applicationId]);

  // The application form has its own dedicated row; if a resend created a portal
  // task for it (title "Application form"), don't list it twice.
  const workflowItems = items.filter(
    (f) => f.title.trim().toLowerCase() !== "application form"
  );
  const done = workflowItems.filter((f) => f.status === "approved").length;

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

      <ul className="mt-1.5 space-y-1">
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
