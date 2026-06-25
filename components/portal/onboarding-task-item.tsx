"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  acknowledgeTask,
  uploadOnboardingDoc,
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
};

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "To do", cls: "bg-amber-100 text-amber-800" },
  submitted: { label: "Submitted", cls: "bg-blue-100 text-blue-800" },
  approved: { label: "Approved", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Needs redoing", cls: "bg-red-100 text-red-800" },
};

export function OnboardingTaskItem({ task }: { task: PortalTask }) {
  const [state, action, pending] = useActionState<OnbState, FormData>(uploadOnboardingDoc, undefined);
  const needsAction = task.status === "pending" || task.status === "rejected";
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
          {task.task_type === "acknowledge" && (
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

          {task.task_type === "document" && (
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
        </div>
      )}

      {task.status === "submitted" && (
        <p className="mt-2 text-xs text-gray-500">Submitted — awaiting review.</p>
      )}
    </li>
  );
}
