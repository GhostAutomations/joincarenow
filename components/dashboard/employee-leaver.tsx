"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, X, RotateCcw } from "lucide-react";
import { markLeaver, reinstateEmployee, setEmploymentType, type HrState } from "@/modules/hr/actions";
import { LEAVING_REASONS, EMPLOYMENT_TYPES } from "@/lib/hr";

export function EmployeeStatusCard({
  employeeId,
  status,
  employmentType,
  leavingReason,
  leavingDetail,
  lastWorkingDay,
  leftAt,
}: {
  employeeId: string;
  status: "active" | "inactive" | "left";
  employmentType: string | null;
  leavingReason: string | null;
  leavingDetail: string | null;
  lastWorkingDay: string | null;
  leftAt: string | null;
}) {
  const router = useRouter();
  const etRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, action, pending] = useActionState<HrState, FormData>(markLeaver, undefined);

  useEffect(() => {
    if (state?.ok) { setOpen(false); router.refresh(); }
  }, [state, router]);

  const field = "rounded-lg border border-gray-300 px-2.5 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
  const left = status === "left";

  return (
    <section className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Employment</span>
          {left ? (
            <span className="rounded-full bg-gray-200 px-2.5 py-0.5 text-xs font-medium text-gray-600">Leaver</span>
          ) : (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">Active</span>
          )}
        </div>

        {/* Employment type — auto-saves on change. */}
        <form ref={etRef} action={setEmploymentType} className="flex items-center gap-2">
          <input type="hidden" name="employeeId" value={employeeId} />
          <label className="text-xs text-gray-500">Type</label>
          <select
            name="employment_type"
            defaultValue={employmentType ?? ""}
            onChange={() => etRef.current?.requestSubmit()}
            className={field}
            disabled={left}
          >
            <option value="" disabled>Set type…</option>
            {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </form>
      </div>

      {left ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3">
          <div className="text-sm text-gray-700">
            <span className="font-medium">Left{leftAt ? ` ${new Date(leftAt).toLocaleDateString("en-GB")}` : ""}</span>
            {leavingReason && <> · {leavingReason === "Other" ? leavingDetail || "Other" : leavingReason}</>}
            {leavingReason !== "Other" && leavingDetail && <span className="text-gray-500"> ({leavingDetail})</span>}
            {lastWorkingDay && <span className="text-gray-500"> · last day {new Date(lastWorkingDay).toLocaleDateString("en-GB")}</span>}
          </div>
          <form action={async (fd) => { await reinstateEmployee(fd); router.refresh(); }}>
            <input type="hidden" name="employeeId" value={employeeId} />
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
              <RotateCcw className="h-4 w-4" /> Reinstate
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-3">
          <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
            <UserMinus className="h-4 w-4" /> Mark as leaver
          </button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Mark as leaver">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Mark as leaver</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-sm text-gray-600">They&apos;ll be archived and removed from active lists and reports.</p>

            <form
              action={action}
              className="mt-4 space-y-3"
              onSubmit={() => { /* useActionState handles state; close on ok via effect below */ }}
            >
              <input type="hidden" name="employeeId" value={employeeId} />
              <label className="block text-sm font-medium text-gray-700">
                Reason for leaving
                <select name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className={`mt-1 block w-full ${field}`}>
                  <option value="" disabled>Choose a reason…</option>
                  {LEAVING_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  <option value="Other">Other (specify)</option>
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                {reason === "Other" ? "Please specify" : "Notes (optional)"}
                <input name="custom" placeholder={reason === "Other" ? "Reason…" : "Any extra detail…"} className={`mt-1 block w-full ${field}`} />
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Last working day (optional)
                <input type="date" name="last_working_day" className={`mt-1 block w-full ${field}`} />
              </label>
              {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
              {state?.ok && <p className="text-sm text-green-700">Saved.</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-70">
                  <UserMinus className="h-4 w-4" /> {pending ? "Saving…" : "Confirm leaver"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
