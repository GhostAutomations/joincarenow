"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, CalendarClock, AlertTriangle } from "lucide-react";
import { updateStage } from "@/modules/prospects/actions";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/prospects";
import { DemoScheduleModal } from "@/components/dashboard/demo-schedule-modal";
import { ProposalModal } from "@/components/dashboard/proposal-modal";

export type BoardCard = {
  id: string;
  name: string;
  stage: string;
  setting: string | null;
  region: string | null;
  value: number | null;
  contact: string | null;
  lastContactAt: string | null;
  nextTaskDue: string | null;
  stageChangedAt: string | null;
  demoAt: string | null;
  proposalResponse: string | null;
};

const STALE_DAYS = 7;
const money = (n: number) => "£" + n.toLocaleString();
function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3);
}
function ago(iso: string | null): string {
  const d = daysSince(iso);
  if (d === null) return "never";
  if (d <= 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

export function ProspectBoard({ initial }: { initial: BoardCard[] }) {
  const router = useRouter();
  const [cards, setCards] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [demoFor, setDemoFor] = useState<{ id: string; name: string } | null>(null);
  const [proposalFor, setProposalFor] = useState<{ id: string; name: string } | null>(null);

  // Re-sync to server truth when fresh data arrives (e.g. realtime refresh
  // after an inbound email/SMS auto-moves a prospect).
  useEffect(() => {
    setCards(initial);
  }, [initial]);

  function move(id: string, stage: string) {
    const card = cards.find((c) => c.id === id);
    if (!card || card.stage === stage) return;
    // Demo booked is reached by scheduling: open the booking popup instead of
    // just moving the card. The booking itself moves it once confirmed.
    if (stage === "demo") {
      setDemoFor({ id, name: card.name });
      return;
    }
    // Proposal is composed in a popup; sending it moves the card.
    if (stage === "proposal") {
      setProposalFor({ id, name: card.name });
      return;
    }
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, stage, stageChangedAt: new Date().toISOString() } : c)));
    const fd = new FormData();
    fd.set("id", id);
    fd.set("stage", stage);
    updateStage(fd).then(() => router.refresh());
  }

  return (
    <>
    <div className="flex gap-2 overflow-x-auto pb-4 lg:grid lg:grid-cols-7 lg:overflow-visible">
      {STAGES.map((s) => {
        const items = cards.filter((c) => c.stage === s);
        const colValue = items.reduce((sum, c) => sum + (c.value ?? 0), 0);
        return (
          <div
            key={s}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId) move(dragId, s); setDragId(null); }}
            className="w-64 shrink-0 lg:w-auto lg:min-w-0"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-white drop-shadow-sm">{STAGE_LABEL[s as Stage]}</span>
              <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-medium text-white">
                {items.length}{colValue ? ` · ${money(colValue)}` : ""}
              </span>
            </div>
            <div className="mt-2 min-h-[60px] space-y-2 rounded-xl bg-white/5 p-1">
              {items.map((c) => {
                const stale = !["won", "lost"].includes(c.stage) && (daysSince(c.lastContactAt) === null || (daysSince(c.lastContactAt) ?? 0) >= STALE_DAYS);
                return (
                  <div
                    key={c.id}
                    draggable
                    onDragStart={() => setDragId(c.id)}
                    onClick={() => router.push(`/admin/sales/${c.id}`)}
                    className={`cursor-pointer rounded-xl border p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing ${
                      c.demoAt ? "border-green-400 border-l-4 border-l-green-600 bg-green-100" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-gray-900">{c.name}</p>
                      {c.value ? <span className="shrink-0 text-xs font-semibold text-emerald-700">{money(c.value)}/mo</span> : null}
                    </div>
                    {c.proposalResponse === "accepted" && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-green-100 px-1.5 py-0.5 text-[11px] font-semibold text-green-800">✓ Proposal accepted</span>
                    )}
                    {c.proposalResponse === "declined" && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600">Proposal declined</span>
                    )}
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {[c.contact, c.setting?.replace("_", " "), c.region].filter(Boolean).join(" · ") || "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{ago(c.stageChangedAt)} in stage</span>
                      <span className="inline-flex items-center gap-1">last: {ago(c.lastContactAt)}</span>
                      {c.nextTaskDue && (
                        <span className="inline-flex items-center gap-1 text-indigo-600"><CalendarClock className="h-3 w-3" />{new Date(c.nextTaskDue).toLocaleDateString("en-GB")}</span>
                      )}
                      {stale && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800"><AlertTriangle className="h-3 w-3" />follow up</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <p className="px-2 py-1 text-xs text-white/40">—</p>}
            </div>
          </div>
        );
      })}
    </div>
    {demoFor && (
      <DemoScheduleModal prospectId={demoFor.id} name={demoFor.name} onClose={() => setDemoFor(null)} />
    )}
    {proposalFor && (
      <ProposalModal prospectId={proposalFor.id} name={proposalFor.name} onClose={() => setProposalFor(null)} />
    )}
    </>
  );
}
