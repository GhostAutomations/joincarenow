"use client";

import { useActionState } from "react";
import { GraduationCap, CheckCircle2, AlertCircle, Clock, RefreshCw } from "lucide-react";
import { resendToCarerAcademy, type EmployeeState } from "@/modules/employees/actions";

export type SyncEvent = {
  id: string;
  status: "success" | "error";
  attempt: number;
  error: string | null;
  created_at: string;
};

const STATUS: Record<string, { label: string; cls: string; icon: typeof CheckCircle2 }> = {
  synced: { label: "Synced", cls: "bg-green-100 text-green-800", icon: CheckCircle2 },
  error: { label: "Failed", cls: "bg-red-100 text-red-800", icon: AlertCircle },
  pending: { label: "Not yet sent", cls: "bg-gray-100 text-gray-600", icon: Clock },
  disabled: { label: "Disabled", cls: "bg-gray-100 text-gray-500", icon: Clock },
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function CarerAcademySync({
  employeeId,
  status,
  academyUserId,
  syncedAt,
  error,
  events,
}: {
  employeeId: string;
  status: string;
  academyUserId: string | null;
  syncedAt: string | null;
  error: string | null;
  events: SyncEvent[];
}) {
  const [state, action, pending] = useActionState<EmployeeState, FormData>(
    resendToCarerAcademy,
    undefined
  );

  const s = STATUS[status] ?? STATUS.pending;
  const StatusIcon = s.icon;

  return (
    <section className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <GraduationCap className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-base font-medium text-gray-900">Carer.Academy</h2>
            <p className="text-xs text-gray-400">Training account sync</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
          <StatusIcon className="h-3.5 w-3.5" /> {s.label}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-gray-500">Last synced</dt>
        <dd className="text-gray-900">{syncedAt ? fmt(syncedAt) : "—"}</dd>
        <dt className="text-gray-500">Academy user ID</dt>
        <dd className="font-mono text-xs text-gray-900">{academyUserId || "—"}</dd>
      </dl>

      {status === "error" && error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {state?.error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-xs text-green-700">
          Sent to Carer.Academy.
        </p>
      )}

      <form action={action} className="mt-4">
        <input type="hidden" name="id" value={employeeId} />
        <button
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-white/60 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
          {status === "synced" ? "Resend" : "Send to Carer.Academy"}
        </button>
      </form>

      {events.length > 0 && (
        <div className="mt-5">
          <p className="text-xs font-medium text-gray-500">Recent activity</p>
          <ul className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                {e.status === "success" ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                ) : (
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                )}
                <span className="text-gray-600">
                  <span className="text-gray-400">{fmt(e.created_at)}</span> · attempt {e.attempt}
                  {e.status === "error" && e.error ? ` — ${e.error}` : " — success"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
