"use client";

import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";
import { getApplicantTeamMessages, type TeamMsg } from "@/modules/staff-messages/actions";

/** Read-only internal team messages tagged to this applicant (audit trail).
 *  Staff-only — applicants can never see these. */
export function ApplicantTeamMessages({ applicationId }: { applicationId: string }) {
  const [items, setItems] = useState<TeamMsg[] | null>(null);
  useEffect(() => { getApplicantTeamMessages(applicationId).then(setItems); }, [applicationId]);

  if (items === null) {
    return (
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">Team messages</p>
        <p className="mt-1 text-sm text-gray-400">Loading…</p>
      </div>
    );
  }
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
        <MessagesSquare className="h-3.5 w-3.5" /> Team messages
        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium normal-case text-amber-700">Internal · applicant can&apos;t see</span>
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-500">No internal messages about this applicant. Tag one from Messages.</p>
      ) : (
        <ul className="mt-1.5 space-y-1.5">
          {items.map((m) => (
            <li key={m.id} className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-1.5 text-sm">
              <p className="text-[11px] text-gray-500">{m.sender} → {m.recipient} · {new Date(m.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-gray-800">{m.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
