"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Phone, Mail, MapPin } from "lucide-react";
import { changeStage, getCvUrl } from "@/modules/applications/actions";

export type AppCard = {
  id: string;
  stage: string;
  created_at: string;
  cover_message: string | null;
  cv_path: string | null;
  answers: { right_to_work?: boolean } | null;
  job_title: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  postcode: string | null;
};

const STAGES: { key: string; label: string; dot: string }[] = [
  { key: "applied", label: "Applied", dot: "bg-blue-500" },
  { key: "reviewing", label: "Reviewing", dot: "bg-indigo-500" },
  { key: "interview", label: "Interview", dot: "bg-purple-500" },
  { key: "offer", label: "Offer", dot: "bg-green-500" },
  { key: "hired", label: "Hired", dot: "bg-emerald-600" },
  { key: "rejected", label: "Not progressing", dot: "bg-gray-400" },
];

function fullName(a: AppCard) {
  const n = [a.first_name, a.last_name].filter(Boolean).join(" ");
  return n || a.email || "Applicant";
}

export function PipelineBoard({ initial }: { initial: AppCard[] }) {
  const router = useRouter();
  const [apps, setApps] = useState(initial);
  const [view, setView] = useState<"board" | "table">("board");
  const [selected, setSelected] = useState<AppCard | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  function move(id: string, stage: string) {
    // Optimistic update; reconcile with the server, reverting on error.
    setApps((prev) => prev.map((a) => (a.id === id ? { ...a, stage } : a)));
    setSelected((s) => (s && s.id === id ? { ...s, stage } : s));
    changeStage(id, stage).then((res) => {
      if (res.error) router.refresh();
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Pipeline</h1>
        <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 text-sm">
          {(["board", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 capitalize ${
                view === v ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {apps.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          No applications yet. When candidates apply through your careers page,
          they&apos;ll appear here.
        </p>
      )}

      {apps.length > 0 && view === "board" && (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {STAGES.map((col) => {
            const cards = apps.filter((a) => a.stage === col.key);
            return (
              <div
                key={col.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragId) move(dragId, col.key);
                  setDragId(null);
                }}
                className="rounded-xl bg-gray-100/70 p-2"
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-medium text-gray-700">
                    {col.label}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">
                    {cards.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {cards.map((a) => (
                    <button
                      key={a.id}
                      draggable
                      onDragStart={() => setDragId(a.id)}
                      onClick={() => setSelected(a)}
                      className="block w-full cursor-grab rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm hover:border-brand-300 active:cursor-grabbing"
                    >
                      <p className="text-sm font-medium text-gray-900">
                        {fullName(a)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">{a.job_title}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <span>
                          {new Date(a.created_at).toLocaleDateString("en-GB")}
                        </span>
                        {a.cv_path && (
                          <span className="inline-flex items-center gap-1 text-gray-500">
                            <FileText className="h-3 w-3" aria-hidden /> CV
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {apps.length > 0 && view === "table" && (
        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Applied</th>
                <th className="px-4 py-3">CV</th>
                <th className="px-4 py-3">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelected(a)}
                      className="font-medium text-gray-900 hover:text-brand-700"
                    >
                      {fullName(a)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.job_title}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(a.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{a.cv_path ? "Yes" : "—"}</td>
                  <td className="px-4 py-3">
                    <StageSelect
                      value={a.stage}
                      onChange={(s) => move(a.id, s)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <ApplicantPanel
          app={selected}
          onClose={() => setSelected(null)}
          onStage={(s) => move(selected.id, s)}
        />
      )}
    </div>
  );
}

function StageSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (s: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
    >
      {STAGES.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

function ApplicantPanel({
  app,
  onClose,
  onStage,
}: {
  app: AppCard;
  onClose: () => void;
  onStage: (s: string) => void;
}) {
  const [cvLoading, setCvLoading] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);

  async function openCv() {
    setCvError(null);
    setCvLoading(true);
    const res = await getCvUrl(app.id);
    setCvLoading(false);
    if (res.url) window.open(res.url, "_blank", "noopener");
    else setCvError(res.error ?? "Could not open CV");
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} aria-hidden />
      <aside className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{fullName(app)}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Applied for</p>
            <p className="mt-0.5 text-sm font-medium text-gray-900">{app.job_title}</p>
            <p className="text-xs text-gray-500">
              {new Date(app.created_at).toLocaleDateString("en-GB")}
            </p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Stage</p>
            <div className="mt-1">
              <StageSelect value={app.stage} onChange={onStage} />
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-gray-700">
            {app.email && (
              <p className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" /> {app.email}
              </p>
            )}
            {app.phone && (
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" /> {app.phone}
              </p>
            )}
            {app.postcode && (
              <p className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" /> {app.postcode}
              </p>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">
              Right to work in UK
            </p>
            <p className="mt-0.5 text-sm text-gray-900">
              {app.answers?.right_to_work ? "Confirmed" : "Not confirmed"}
            </p>
          </div>

          {app.cover_message && (
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-400">
                Cover message
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                {app.cover_message}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400">CV</p>
            {app.cv_path ? (
              <button
                onClick={openCv}
                disabled={cvLoading}
                className="mt-1 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-60"
              >
                <FileText className="h-4 w-4" />
                {cvLoading ? "Opening…" : "View CV"}
              </button>
            ) : (
              <p className="mt-0.5 text-sm text-gray-500">No CV uploaded.</p>
            )}
            {cvError && <p className="mt-1 text-xs text-red-600">{cvError}</p>}
          </div>
        </div>
      </aside>
    </div>
  );
}
