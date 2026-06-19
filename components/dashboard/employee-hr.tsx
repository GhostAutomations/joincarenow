"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2, FileText, Download, Plus, X } from "lucide-react";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import {
  addAbsence,
  deleteAbsence,
  addWarning,
  deleteWarning,
  uploadHrDocument,
  deleteHrDocument,
  getHrDocUrl,
  type HrState,
} from "@/modules/hr/actions";
import { SignedDocs, type SignedDoc } from "@/components/documents/signed-docs";
import { getCvUrl } from "@/modules/applications/actions";
import { getFormSubmissionView, type FormView } from "@/modules/onboarding/actions";

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";
const lbl = "text-xs font-medium text-gray-600";

export type Absence = {
  id: string;
  absence_type: string;
  start_date: string;
  end_date: string | null;
  days: number | null;
  reason: string | null;
};
export type Warning = {
  id: string;
  level: string;
  title: string;
  note: string | null;
  issued_date: string;
  review_date: string | null;
};
export type HrDoc = {
  id: string;
  doc_type: string | null;
  title: string;
  issued_date: string | null;
  expiry_date: string | null;
};
export type FormDoc = { id: string; name: string; submittedAt: string | null };

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const TABS = ["Absences", "Warnings", "Documents"] as const;
type Tab = (typeof TABS)[number];

export function EmployeeHr({
  employeeId,
  absences,
  warnings,
  documents,
  contracts = [],
  policies = [],
  forms = [],
  cvApplicationId = null,
}: {
  employeeId: string;
  absences: Absence[];
  warnings: Warning[];
  documents: HrDoc[];
  contracts?: SignedDoc[];
  policies?: SignedDoc[];
  forms?: FormDoc[];
  cvApplicationId?: string | null;
}) {
  const [tab, setTab] = useState<Tab>("Absences");
  const docCount =
    documents.length + contracts.length + policies.length + forms.length + (cvApplicationId ? 1 : 0);

  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="flex items-center gap-1 border-b border-gray-100 px-3 pt-3">
        {TABS.map((t) => {
          const count = t === "Absences" ? absences.length : t === "Warnings" ? warnings.length : docCount;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium ${
                tab === t
                  ? "border-b-2 border-brand-600 text-brand-700"
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              {t} <span className="text-xs text-gray-400">({count})</span>
            </button>
          );
        })}
      </div>
      <div className="p-5">
        {tab === "Absences" && <Absences employeeId={employeeId} items={absences} />}
        {tab === "Warnings" && <Warnings employeeId={employeeId} items={warnings} />}
        {tab === "Documents" && (
          <DocumentsTab
            employeeId={employeeId}
            uploads={documents}
            contracts={contracts}
            policies={policies}
            forms={forms}
            cvApplicationId={cvApplicationId}
          />
        )}
      </div>
    </section>
  );
}

function useResetOnOk(state: HrState, ref: React.RefObject<HTMLFormElement | null>) {
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state, ref]);
}

// ---------- Absences ----------
function Absences({ employeeId, items }: { employeeId: string; items: Absence[] }) {
  const [state, action] = useActionState<HrState, FormData>(addAbsence, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnOk(state, ref);
  const totalDays = items.reduce((a, b) => a + (b.days ?? 0), 0);

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No absences logged.</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-gray-400">{totalDays} day(s) recorded in total</p>
          <ul className="divide-y divide-gray-100">
            {items.map((a) => (
              <li key={a.id} className="flex items-start justify-between py-2.5">
                <div>
                  <span className="text-sm font-medium capitalize text-gray-900">{a.absence_type}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {fmt(a.start_date)}
                    {a.end_date && ` – ${fmt(a.end_date)}`}
                    {a.days != null && ` · ${a.days} day(s)`}
                  </span>
                  {a.reason && <p className="mt-0.5 text-xs text-gray-500">{a.reason}</p>}
                </div>
                <DeleteBtn action={deleteAbsence} id={a.id} employeeId={employeeId} />
              </li>
            ))}
          </ul>
        </>
      )}

      <form ref={ref} action={action} className="mt-4 rounded-lg border border-dashed border-gray-300 p-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        {state?.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className={lbl}>
            Type
            <select name="absenceType" className={cls} defaultValue="sickness">
              <option value="sickness">Sickness</option>
              <option value="holiday">Holiday</option>
              <option value="unauthorised">Unauthorised</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className={lbl}>
            From
            <input type="date" name="startDate" className={cls} />
          </label>
          <label className={lbl}>
            To
            <input type="date" name="endDate" className={cls} />
          </label>
          <label className={lbl}>
            Days
            <input type="number" name="days" step="0.5" min="0" className={cls} />
          </label>
        </div>
        <label className={`${lbl} mt-3 block`}>
          Reason (optional)
          <input name="reason" className={cls} />
        </label>
        <AddBtn>Log absence</AddBtn>
      </form>
    </div>
  );
}

// ---------- Warnings ----------
const LEVEL_STYLE: Record<string, string> = {
  verbal: "bg-amber-50 text-amber-700",
  written: "bg-orange-50 text-orange-700",
  final: "bg-red-50 text-red-700",
};

function Warnings({ employeeId, items }: { employeeId: string; items: Warning[] }) {
  const [state, action] = useActionState<HrState, FormData>(addWarning, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnOk(state, ref);

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No warnings recorded.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((w) => (
            <li key={w.id} className="flex items-start justify-between py-2.5">
              <div>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium capitalize ${LEVEL_STYLE[w.level] ?? "bg-gray-100 text-gray-700"}`}
                >
                  {w.level}
                </span>
                <span className="ml-2 text-sm font-medium text-gray-900">{w.title}</span>
                <span className="ml-2 text-xs text-gray-500">
                  Issued {fmt(w.issued_date)}
                  {w.review_date && ` · review ${fmt(w.review_date)}`}
                </span>
                {w.note && <p className="mt-0.5 text-xs text-gray-500">{w.note}</p>}
              </div>
              <DeleteBtn action={deleteWarning} id={w.id} employeeId={employeeId} />
            </li>
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="mt-4 rounded-lg border border-dashed border-gray-300 p-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        {state?.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className={lbl}>
            Level
            <select name="level" className={cls} defaultValue="verbal">
              <option value="verbal">Verbal</option>
              <option value="written">Written</option>
              <option value="final">Final</option>
            </select>
          </label>
          <label className={`${lbl} sm:col-span-2`}>
            Title
            <input name="title" placeholder="e.g. Late attendance" className={cls} />
          </label>
          <label className={lbl}>
            Issued
            <input type="date" name="issuedDate" className={cls} />
          </label>
          <label className={lbl}>
            Review date
            <input type="date" name="reviewDate" className={cls} />
          </label>
        </div>
        <label className={`${lbl} mt-3 block`}>
          Notes (optional)
          <textarea name="note" rows={2} className={cls} />
        </label>
        <AddBtn>Record warning</AddBtn>
      </form>
    </div>
  );
}

// ---------- Documents (categorised) ----------
function DocumentsTab({
  employeeId,
  uploads,
  contracts,
  policies,
  forms,
  cvApplicationId,
}: {
  employeeId: string;
  uploads: HrDoc[];
  contracts: SignedDoc[];
  policies: SignedDoc[];
  forms: FormDoc[];
  cvApplicationId: string | null;
}) {
  const uploadsCount = uploads.length + (cvApplicationId ? 1 : 0);
  return (
    <div className="space-y-2.5">
      <CollapsibleSection title="Contracts" count={contracts.length}>
        <SignedDocs docs={contracts} />
      </CollapsibleSection>
      <CollapsibleSection title="Policies" count={policies.length}>
        <SignedDocs docs={policies} />
      </CollapsibleSection>
      <CollapsibleSection title="Forms" count={forms.length}>
        <Forms items={forms} />
      </CollapsibleSection>
      <CollapsibleSection title="Uploaded files" count={uploadsCount}>
        {cvApplicationId && <CvRow applicationId={cvApplicationId} />}
        <Uploads employeeId={employeeId} items={uploads} />
      </CollapsibleSection>
    </div>
  );
}

function Forms({ items }: { items: FormDoc[] }) {
  const [view, setView] = useState<FormView | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function open(id: string) {
    setLoadingId(id);
    const data = await getFormSubmissionView(id);
    setLoadingId(null);
    if (data) setView(data);
  }

  if (items.length === 0) return <p className="text-sm text-gray-500">No forms submitted.</p>;

  return (
    <>
      <ul className="divide-y divide-gray-100">
        {items.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 py-2.5">
            <button
              onClick={() => open(f.id)}
              disabled={loadingId === f.id}
              className="flex min-w-0 items-center gap-2 text-left text-sm text-gray-900 hover:text-brand-600 disabled:opacity-60"
            >
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="truncate font-medium">{f.name}</span>
            </button>
            <span className="shrink-0 text-xs text-gray-500">
              {loadingId === f.id ? "Opening…" : f.submittedAt ? fmt(f.submittedAt) : ""}
            </span>
          </li>
        ))}
      </ul>

      {view && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="absolute inset-0 bg-black/50" aria-hidden onClick={() => setView(null)} />
          <div className="relative mx-auto my-8 w-full max-w-2xl px-4">
            <div className="rounded-2xl bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
                <h2 className="text-base font-semibold text-gray-900">{view.name}</h2>
                <button onClick={() => setView(null)} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
                {view.items.length === 0 ? (
                  <p className="text-sm text-gray-500">No answers recorded.</p>
                ) : (
                  <dl className="space-y-3">
                    {view.items.map((it, i) => (
                      <div key={i}>
                        <dt className="text-xs text-gray-500">{it.label}</dt>
                        <dd className="text-sm text-gray-900">{it.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CvRow({ applicationId }: { applicationId: string }) {
  async function open() {
    const res = await getCvUrl(applicationId);
    if (res.url) window.open(res.url, "_blank");
    else alert(res.error ?? "Could not open the CV.");
  }
  return (
    <button
      onClick={open}
      className="mb-2 flex w-full items-center gap-2 rounded-md py-2 text-left text-sm text-gray-900 hover:text-brand-600"
    >
      <FileText className="h-4 w-4 text-gray-400" />
      <span className="font-medium">CV</span>
      <span className="text-xs text-gray-500">· uploaded by applicant</span>
      <Download className="h-3.5 w-3.5 text-gray-300" />
    </button>
  );
}

function Uploads({ employeeId, items }: { employeeId: string; items: HrDoc[] }) {
  const [state, action] = useActionState<HrState, FormData>(uploadHrDocument, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useResetOnOk(state, ref);

  async function open(id: string) {
    const res = await getHrDocUrl(id);
    if (res.url) window.open(res.url, "_blank");
  }

  return (
    <div>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">No documents stored.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((d) => (
            <li key={d.id} className="flex items-center justify-between py-2.5">
              <button
                onClick={() => open(d.id)}
                className="flex items-center gap-2 text-left text-sm text-gray-900 hover:text-brand-600"
              >
                <FileText className="h-4 w-4 text-gray-400" />
                <span>
                  <span className="font-medium">{d.title}</span>
                  <span className="ml-2 text-xs text-gray-500">
                    {d.doc_type && `${d.doc_type} · `}
                    {d.issued_date && `issued ${fmt(d.issued_date)}`}
                    {d.expiry_date && ` · expires ${fmt(d.expiry_date)}`}
                  </span>
                </span>
                <Download className="h-3.5 w-3.5 text-gray-300" />
              </button>
              <DeleteBtn action={deleteHrDocument} id={d.id} employeeId={employeeId} />
            </li>
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="mt-4 rounded-lg border border-dashed border-gray-300 p-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        {state?.error && <p className="mb-2 text-xs text-red-600">{state.error}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={lbl}>
            Document name
            <input name="title" placeholder="e.g. Signed contract" className={cls} />
          </label>
          <label className={lbl}>
            Type (optional)
            <input name="docType" placeholder="e.g. Contract, Letter" className={cls} />
          </label>
          <label className={lbl}>
            Issued (optional)
            <input type="date" name="issuedDate" className={cls} />
          </label>
          <label className={lbl}>
            Expiry (optional)
            <input type="date" name="expiryDate" className={cls} />
          </label>
        </div>
        <label className={`${lbl} mt-3 block`}>
          File
          <input type="file" name="file" className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700" />
        </label>
        <AddBtn>Upload document</AddBtn>
      </form>
    </div>
  );
}

// ---------- shared bits ----------
function AddBtn({ children }: { children: React.ReactNode }) {
  return (
    <button className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
      <Plus className="h-4 w-4" />
      {children}
    </button>
  );
}

function DeleteBtn({
  action,
  id,
  employeeId,
}: {
  action: (fd: FormData) => void | Promise<void>;
  id: string;
  employeeId: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
        <Trash2 className="h-4 w-4" />
      </button>
    </form>
  );
}
