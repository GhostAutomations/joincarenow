"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { addMyReferee, deleteMyReferee } from "@/modules/references/actions";

export type MyRef = {
  id: string;
  application_id: string;
  referee_name: string;
  referee_email: string;
  referee_employer: string | null;
  relationship: string | null;
  status: string;
};

export type RefApplication = {
  application_id: string;
  job_title: string;
  company_name: string;
};

const STATUS: Record<string, { label: string; text: string; icon: typeof CheckCircle2; color: string }> = {
  approved: { label: "Approved", text: "text-green-700", icon: CheckCircle2, color: "text-green-600" },
  received: { label: "Submitted", text: "text-blue-600", icon: CheckCircle2, color: "text-blue-500" },
  sent: { label: "Request sent", text: "text-blue-600", icon: Clock, color: "text-blue-500" },
  pending: { label: "Not sent yet", text: "text-gray-500", icon: Clock, color: "text-gray-400" },
  rejected: { label: "Changes requested", text: "text-red-600", icon: AlertTriangle, color: "text-red-500" },
};

export function PortalReferees({
  applications,
  references,
}: {
  applications: RefApplication[];
  references: MyRef[];
}) {
  const router = useRouter();
  const [openFor, setOpenFor] = useState<string | null>(null);

  async function remove(id: string) {
    await deleteMyReferee(id);
    router.refresh();
  }

  if (applications.length === 0) return null;

  return (
    <ul className="mt-4 space-y-3">
      {applications.map((app) => {
        const refs = references.filter((r) => r.application_id === app.application_id);
        return (
          <li
            key={app.application_id}
            className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-gray-900">{app.job_title}</p>
                <p className="text-sm text-gray-500">{app.company_name}</p>
              </div>
              <button
                onClick={() => setOpenFor(openFor === app.application_id ? null : app.application_id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <Plus className="h-4 w-4" /> Add referee
              </button>
            </div>

            {openFor === app.application_id && (
              <AddForm
                applicationId={app.application_id}
                onDone={() => {
                  setOpenFor(null);
                  router.refresh();
                }}
              />
            )}

            {refs.length > 0 && (
              <ul className="mt-3 divide-y divide-gray-100">
                {refs.map((r) => {
                  const s = STATUS[r.status] ?? STATUS.pending;
                  const Icon = s.icon;
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-2.5">
                      <Icon className={`h-5 w-5 shrink-0 ${s.color}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{r.referee_name}</p>
                        <p className="truncate text-xs text-gray-500">
                          {r.referee_email}
                          {r.referee_employer ? ` · ${r.referee_employer}` : ""}
                        </p>
                      </div>
                      <span className={`text-xs font-medium ${s.text}`}>{s.label}</span>
                      {r.status === "pending" && (
                        <button
                          onClick={() => remove(r.id)}
                          aria-label="Remove referee"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const input =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function AddForm({ applicationId, onDone }: { applicationId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function action(fd: FormData) {
    setBusy(true);
    setError(null);
    fd.set("applicationId", applicationId);
    const r = await addMyReferee(fd);
    setBusy(false);
    if (r?.error) setError(r.error);
    else onDone();
  }

  return (
    <form action={action} className="mt-3 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-2">
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Referee name *</span>
        <input name="name" required className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Referee email *</span>
        <input name="email" type="email" required className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Employer / organisation</span>
        <input name="employer" className={input} />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-600">Your relationship (e.g. former manager)</span>
        <input name="relationship" className={input} />
      </label>
      {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
      <div className="sm:col-span-2">
        <button
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> {busy ? "Adding…" : "Add referee"}
        </button>
      </div>
    </form>
  );
}
