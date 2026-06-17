"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Send, Eye, Trash2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  sendReferenceRequest,
  reviewReference,
  getReferenceReview,
  deleteReference,
  type ReferenceReview,
} from "@/modules/references/actions";
import { ReferenceReviewModal } from "@/components/dashboard/reference-review-modal";

export type RefCard = {
  id: string;
  applicant_name: string;
  job_title: string;
  referee_name: string;
  referee_email: string;
  referee_employer: string | null;
  relationship: string | null;
  status: string;
};

const COLUMNS: { key: string; title: string; statuses: string[]; dot: string }[] = [
  { key: "pending", title: "Ready to send", statuses: ["pending"], dot: "bg-gray-400" },
  { key: "sent", title: "Awaiting referee", statuses: ["sent", "rejected"], dot: "bg-blue-500" },
  { key: "received", title: "Awaiting approval", statuses: ["received"], dot: "bg-amber-500" },
  { key: "approved", title: "Approved", statuses: ["approved"], dot: "bg-green-500" },
];

export function ReferencingBoard({
  cards,
  companyId,
}: {
  cards: RefCard[];
  companyId: string;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
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

  async function approve(id: string) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", "approved");
    await reviewReference(fd);
    setModal(null);
    router.refresh();
  }

  // "Send back" re-issues the link to the referee, returning the card to column 2.
  async function sendBack(id: string) {
    await sendReferenceRequest(id);
    setModal(null);
    router.refresh();
  }

  if (cards.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
        No references yet. When an applicant completes their &quot;Your References&quot; form, their
        referees appear here ready to send.
      </div>
    );
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const colCards = cards.filter((c) => col.statuses.includes(c.status));
        return (
          <div key={col.key} className="rounded-2xl border border-white/40 bg-white/15 p-3 backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-white drop-shadow-sm">
                <span className={`h-2 w-2 rounded-full ${col.dot}`} /> {col.title}
              </span>
              <span className="text-xs font-medium text-white/80">{colCards.length}</span>
            </div>
            <div className="space-y-2">
              {colCards.map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  busy={busyId === c.id}
                  onSend={() => send(c.id)}
                  onOpen={() => open(c.id)}
                  onRemove={() => remove(c.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

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

function Card({
  card,
  busy,
  onSend,
  onOpen,
  onRemove,
}: {
  card: RefCard;
  busy: boolean;
  onSend: () => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const changesRequested = card.status === "rejected";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{card.referee_name}</p>
          <p className="truncate text-xs text-gray-500">
            {card.referee_email}
            {card.referee_employer ? ` · ${card.referee_employer}` : ""}
          </p>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove referee"
          className="rounded-lg p-1 text-gray-300 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-400">
        {card.applicant_name} · {card.job_title}
      </p>
      {changesRequested && (
        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Changes requested
        </p>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        {(card.status === "pending" || card.status === "sent" || card.status === "rejected") && (
          <button
            onClick={onSend}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            <Send className="h-3.5 w-3.5" />
            {card.status === "pending" ? "Send" : busy ? "Sending…" : "Resend"}
          </button>
        )}
        {(card.status === "received" || card.status === "approved") && (
          <button
            onClick={onOpen}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Eye className="h-3.5 w-3.5" /> {card.status === "approved" ? "View" : "Review"}
          </button>
        )}
        {card.status === "sent" && (
          <span className="inline-flex items-center gap-1 text-xs text-blue-500">
            <Clock className="h-3.5 w-3.5" /> Awaiting referee
          </span>
        )}
        {card.status === "approved" && (
          <span className="inline-flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
          </span>
        )}
      </div>
    </div>
  );
}
