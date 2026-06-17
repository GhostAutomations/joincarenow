"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { reviewTask } from "@/modules/onboarding/actions";

export type FormItem = {
  id: string;
  title: string;
  status: string; // pending | submitted | approved | rejected
};

type Answer = { label: string; value: string };

const STATUS: Record<
  string,
  { label: string; text: string; icon: typeof CheckCircle2; iconColor: string }
> = {
  approved: { label: "Complete", text: "text-green-700", icon: CheckCircle2, iconColor: "text-green-600" },
  submitted: { label: "Submitted", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-amber-500" },
  rejected: { label: "Resent", text: "text-red-600", icon: AlertTriangle, iconColor: "text-red-500" },
  pending: { label: "Outstanding", text: "text-amber-600", icon: AlertTriangle, iconColor: "text-amber-500" },
};

export function ApplicantForms({
  forms,
  applicationAnswers,
}: {
  forms: FormItem[];
  applicationAnswers: Answer[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(forms);
  const [open, setOpen] = useState<string | null>(null);
  const [showAppForm, setShowAppForm] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const done = items.filter((f) => f.status === "approved").length;

  async function review(id: string, status: "approved" | "rejected" | "pending") {
    setBusy(true);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", status);
    if (status === "rejected") fd.set("note", note);
    await reviewTask(fd);
    setBusy(false);
    setItems((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    setNote("");
    setOpen(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-gray-400">Forms</p>
        {items.length > 0 && (
          <span className="text-xs text-gray-500">{done}/{items.length} approved</span>
        )}
      </div>

      <ul className="mt-1.5 space-y-1">
        {/* Application form (filled at apply time) */}
        {applicationAnswers.length > 0 && (
          <li className="rounded-lg border border-gray-100">
            <button
              onClick={() => setShowAppForm((s) => !s)}
              className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm"
            >
              <FileText className="h-4 w-4 shrink-0 text-blue-500" />
              <span className="text-gray-800">Application form</span>
              <span className="ml-auto text-xs text-blue-700">Submitted</span>
              <ChevronDown className={`h-4 w-4 text-gray-400 transition ${showAppForm ? "rotate-180" : ""}`} />
            </button>
            {showAppForm && (
              <dl className="space-y-2 border-t border-gray-100 px-3 py-2">
                {applicationAnswers.map((a, i) => (
                  <div key={i}>
                    <dt className="text-xs text-gray-500">{a.label}</dt>
                    <dd className="text-sm text-gray-800">{a.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        )}

        {/* Workflow form tasks */}
        {items.map((f) => {
          const s = STATUS[f.status] ?? STATUS.pending;
          const Icon = s.icon;
          const isOpen = open === f.id;
          return (
            <li key={f.id} className="rounded-lg border border-gray-100">
              <button
                onClick={() => setOpen(isOpen ? null : f.id)}
                className="flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-gray-50"
              >
                <Icon className={`h-4 w-4 shrink-0 ${s.iconColor}`} />
                <span className="text-gray-800">{f.title}</span>
                <span className={`ml-auto text-xs ${s.text}`}>{s.label}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="space-y-2 border-t border-gray-100 px-3 py-2">
                  {f.status !== "approved" && (
                    <button
                      onClick={() => review(f.id, "approved")}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}
                  <div>
                    <textarea
                      value={isOpen ? note : ""}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder="Optional message — what needs changing / more info…"
                      className="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => review(f.id, "rejected")}
                      disabled={busy}
                      className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
                    >
                      Resend to applicant
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}

        {items.length === 0 && applicationAnswers.length === 0 && (
          <li className="text-sm text-gray-500">No forms assigned.</li>
        )}
      </ul>
    </div>
  );
}
