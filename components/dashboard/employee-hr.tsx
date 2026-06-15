"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Trash2, FileText, Download, Plus } from "lucide-react";
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

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("en-GB") : "—");

const TABS = ["Absences", "Warnings", "Documents"] as const;
type Tab = (typeof TABS)[number];

export function EmployeeHr({
  employeeId,
  absences,
  warnings,
  documents,
}: {
  employeeId: string;
  absences: Absence[];
  warnings: Warning[];
  documents: HrDoc[];
}) {
  const [tab, setTab] = useState<Tab>("Absences");

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center gap-1 border-b border-gray-100 px-3 pt-3">
        {TABS.map((t) => {
          const count = t === "Absences" ? absences.length : t === "Warnings" ? warnings.length : documents.length;
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
        {tab === "Documents" && <Documents employeeId={employeeId} items={documents} />}
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

// ---------- Documents ----------
function Documents({ employeeId, items }: { employeeId: string; items: HrDoc[] }) {
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
