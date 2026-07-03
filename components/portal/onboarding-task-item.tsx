"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  acknowledgeTask,
  uploadOnboardingDoc,
  submitRegistration,
  type OnbState,
} from "@/modules/onboarding/actions";

export type PortalTask = {
  task_id: string;
  title: string;
  task_type: string;
  status: string;
  body: string | null;
  form_id: string | null;
  due_date: string | null;
  note: string | null;
  document_id: string | null;
  document_kind: string | null;
  doc_kind: string | null;
  reg_number: string | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "To do", cls: "bg-amber-100 text-amber-800" },
  submitted: { label: "Submitted", cls: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Needs redoing", cls: "bg-red-100 text-red-800" },
};

export function OnboardingTaskItem({ task }: { task: PortalTask }) {
  const [state, action, pending] = useActionState<OnbState, FormData>(uploadOnboardingDoc, undefined);
  const [regState, regAction, regPending] = useActionState<OnbState, FormData>(submitRegistration, undefined);
  const [noCard, setNoCard] = useState(false);
  const needsAction = task.status === "pending" || task.status === "rejected";
  const isRegistration = task.task_type === "document" && task.doc_kind === "registration";
  const s = STATUS[task.status] ?? STATUS.pending;

  return (
    <li className="rounded-xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-gray-900">{task.title}</p>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.cls}`}>
          {s.label}
        </span>
      </div>
      {task.body &&
        !["", "none", "n/a", "na", "-"].includes(task.body.trim().toLowerCase()) && (
          <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{task.body}</p>
        )}
      {task.status === "rejected" && task.note && (
        <p className="mt-1 text-xs text-red-600">Reviewer: {task.note}</p>
      )}

      {needsAction && (
        <div className="mt-3">
          {task.task_type === "acknowledge" && task.document_id && (
            <Link
              href={`/portal/onboarding/${task.task_id}/sign`}
              className="inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Read &amp; sign
            </Link>
          )}

          {task.task_type === "acknowledge" && !task.document_id && (
            <form action={acknowledgeTask}>
              <input type="hidden" name="id" value={task.task_id} />
              <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                I confirm
              </button>
            </form>
          )}

          {task.task_type === "form" && task.form_id && (
            <Link
              href={`/portal/onboarding/${task.task_id}`}
              className="inline-block rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Complete form
            </Link>
          )}

          {task.task_type === "document" && !isRegistration && (
            <form action={action} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="taskId" value={task.task_id} />
              <input
                type="file"
                name="doc"
                required
                className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
              />
              <button
                disabled={pending}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {pending ? "Uploading…" : "Upload"}
              </button>
              {pending && <span className="text-xs text-gray-500">Please wait…</span>}
              {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
            </form>
          )}

          {isRegistration && (
            <form action={regAction} className="space-y-2.5">
              <input type="hidden" name="taskId" value={task.task_id} />
              <div>
                <label className="text-xs font-medium text-gray-600">Registration number</label>
                <input
                  name="reg_number"
                  required
                  defaultValue={task.reg_number ?? ""}
                  placeholder="e.g. W/1234567 (Social Care Wales), SSSC or NISCC number"
                  className="mt-1 block w-full max-w-md rounded-lg border border-white/60 bg-white/80 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  name="no_card"
                  checked={noCard}
                  onChange={(e) => setNoCard(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-400 text-brand-600 focus:ring-brand-500"
                />
                I don&apos;t have a card or certificate to upload — number only
              </label>
              {!noCard && (
                <input
                  type="file"
                  name="doc"
                  accept="image/*,.pdf"
                  className="block text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
                />
              )}
              <div className="flex items-center gap-2">
                <button
                  disabled={regPending}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {regPending ? "Saving…" : "Submit"}
                </button>
                {regPending && <span className="text-xs text-gray-500">Please wait…</span>}
                {regState?.error && <span className="text-xs text-red-600">{regState.error}</span>}
              </div>
            </form>
          )}
        </div>
      )}

      {task.status === "submitted" && (
        <p className="mt-2 text-xs text-gray-500">Submitted — awaiting review.</p>
      )}
    </li>
  );
}
