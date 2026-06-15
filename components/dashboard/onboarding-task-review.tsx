"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import { reviewTask, getOnboardingDocUrl } from "@/modules/onboarding/actions";

export type OnbTask = {
  id: string;
  title: string;
  task_type: string;
  status: string;
  required: boolean;
  doc_path: string | null;
  note: string | null;
  due_date: string | null;
};

const STATUS: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export function OnboardingTaskReview({ task }: { task: OnbTask }) {
  const [cvErr, setCvErr] = useState<string | null>(null);

  async function openDoc() {
    setCvErr(null);
    const res = await getOnboardingDocUrl(task.id);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setCvErr(res.error ?? "Could not open");
  }

  return (
    <li className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-900">
            {task.title}
            {!task.required && <span className="ml-1 text-xs text-gray-400">(optional)</span>}
          </p>
          <p className="text-xs capitalize text-gray-400">
            {task.task_type === "acknowledge" ? "Read & confirm" : task.task_type}
            {task.due_date && ` · due ${new Date(task.due_date).toLocaleDateString("en-GB")}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[task.status] ?? ""}`}>
          {task.status}
        </span>
      </div>

      {(task.status === "submitted" || task.status === "approved" || task.status === "rejected") && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {task.task_type === "document" && task.doc_path && (
            <button
              onClick={openDoc}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              <FileText className="h-3.5 w-3.5" /> View document
            </button>
          )}
          {task.status !== "approved" && (
            <form action={reviewTask}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value="approved" />
              <button className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700">
                Approve
              </button>
            </form>
          )}
          {task.status !== "rejected" && (
            <form action={reviewTask}>
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="status" value="rejected" />
              <button className="rounded-md border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                Reject
              </button>
            </form>
          )}
        </div>
      )}
      {cvErr && <p className="mt-1 text-xs text-red-600">{cvErr}</p>}
      {task.note && <p className="mt-1 text-xs text-gray-500">Note: {task.note}</p>}
    </li>
  );
}
