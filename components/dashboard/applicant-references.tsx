"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, AlertTriangle, Clock, Send, Eye } from "lucide-react";
import {
  getApplicationReferences,
  sendReferenceRequest,
  getReferenceReview,
  reviewReference,
  type ApplicationReference,
  type ReferenceReview,
} from "@/modules/references/actions";
import { ReferenceReviewModal } from "@/components/dashboard/reference-review-modal";

const STATUS: Record<
  string,
  { label: string; text: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  approved: { label: "Approved", text: "text-green-700", icon: CheckCircle2, iconColor: "text-green-600" },
  received: { label: "Awaiting approval", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-amber-500" },
  sent: { label: "Awaiting referee", text: "text-blue-600", icon: Clock, iconColor: "text-blue-500" },
  rejected: { label: "Changes requested", text: "text-red-600", icon: AlertTriangle, iconColor: "text-red-500" },
  pending: { label: "Ready to send", text: "text-gray-500", icon: Clock, iconColor: "text-gray-400" },
};

export function ApplicantReferences({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ApplicationReference[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ data: ReferenceReview } | null>(null);

  const load = () => getApplicationReferences(applicationId).then(setItems);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  async function send(id: string) {
    setBusyId(id);
    const r = await sendReferenceRequest(id);
    setBusyId(null);
    if (r?.error) { alert(r.error); return; }
    await load();
    router.refresh();
  }

  async function open(id: string) {
    setBusyId(id);
    const data = await getReferenceReview(id);
    setBusyId(null);
    if (data) setModal({ data });
  }

  async function approve(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "approved");
    await reviewReference(fd);
    setModal(null);
    await load();
    router.refresh();
  }

  async function sendBack(id: string) {
    await sendReferenceRequest(id);
    setModal(null);
    await load();
    router.refresh();
  }

  if (items === null) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">References</p>
        <p className="mt-1 text-sm text-gray-400">Loading…</p>
      </div>
    );
  }

  const approved = items.filter((i) => i.status === "approved").length;

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-gray-400">References</p>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">{approved}/{items.length} approved</span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">
          No referees yet — they appear here once the applicant completes their references form.
        </p>
      ) : (
        <ul className="mt-1.5 space-y-0.5">
          {items.map((r) => {
            const s = STATUS[r.status] ?? STATUS.pending;
            const Icon = s.icon;
            const canSend = r.status === "pending" || r.status === "sent" || r.status === "rejected";
            const canReview = r.status === "received" || r.status === "approved";
            return (
              <li key={r.id} className="flex items-center gap-2 rounded-md px-1 py-1.5 text-sm">
                <Icon className={`h-4 w-4 shrink-0 ${s.iconColor}`} />
                <span className="min-w-0 truncate text-gray-800">{r.referee_name}</span>
                <span className={`ml-auto shrink-0 text-xs ${s.text}`}>{s.label}</span>
                {canSend && (
                  <button
                    onClick={() => send(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/40 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white/60 disabled:opacity-60"
                  >
                    <Send className="h-3 w-3" /> {r.status === "pending" ? "Send" : "Resend"}
                  </button>
                )}
                {canReview && (
                  <button
                    onClick={() => open(r.id)}
                    disabled={busyId === r.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/40 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-white/60 disabled:opacity-60"
                  >
                    <Eye className="h-3 w-3" /> {r.status === "approved" ? "View" : "Review"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <ReferenceReviewModal
          data={modal.data}
          onApprove={() => approve(modal.data.id)}
          onReject={() => sendBack(modal.data.id)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
