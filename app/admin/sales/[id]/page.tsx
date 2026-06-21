import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { addNote, addContact, addTask, toggleTask } from "@/modules/prospects/actions";
import { stopEnrolment } from "@/modules/prospects/sequence-actions";
import { ProspectStageSelect } from "@/components/dashboard/prospect-stage-select";
import { ProspectComposer } from "@/components/dashboard/prospect-composer";
import { ProspectEnrol } from "@/components/dashboard/prospect-enrol";

const input = "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export default async function ProspectRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: company }, { data: contacts }, { data: activities }, { data: tasks }, { data: sequences }, { data: enrolments }] = await Promise.all([
    db.from("prospect_companies").select("*").eq("id", id).single(),
    db.from("prospect_contacts").select("*").eq("prospect_company_id", id).order("created_at"),
    db.from("prospect_activities").select("*").eq("prospect_company_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("prospect_tasks").select("*").eq("prospect_company_id", id).order("due_date", { nullsFirst: false }),
    db.from("prospect_sequences").select("id, name").eq("active", true).order("name"),
    db.from("prospect_enrolments").select("id, status, step_index, stopped_reason, prospect_sequences(name), prospect_contacts(name, email)").eq("prospect_company_id", id).order("created_at", { ascending: false }),
  ]);
  if (!company) notFound();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = company as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const acts = (activities ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const conts = (contacts ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tks = (tasks ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enrols = (enrolments ?? []) as any[];
  const seqOpts = (sequences ?? []).map((s) => ({ id: s.id as string, label: s.name as string }));
  const contactOpts = conts.map((ct) => ({ id: ct.id as string, label: (ct.name || ct.email || ct.phone) as string }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/sales" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white drop-shadow-sm">{c.name}</h1>
          <p className="text-sm text-white/80">
            {[c.setting_type?.replace("_", " "), c.region, c.size_band].filter(Boolean).join(" · ") || "Prospect"}
          </p>
        </div>
        <ProspectStageSelect id={id} stage={c.stage} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: contacts + tasks */}
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-gray-900">Contacts</h2>
            <ul className="mt-2 divide-y divide-gray-100">
              {conts.map((ct) => (
                <li key={ct.id} className="py-2 text-sm">
                  <p className="font-medium text-gray-900">{ct.name || ct.email || ct.phone}</p>
                  <p className="text-xs text-gray-500">
                    {[ct.role, ct.email, ct.phone].filter(Boolean).join(" · ")}
                    {ct.opted_out && <span className="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-gray-600">opted out</span>}
                  </p>
                </li>
              ))}
              {conts.length === 0 && <li className="py-2 text-xs text-gray-400">No contacts yet.</li>}
            </ul>
            <form action={addContact} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              <input type="hidden" name="id" value={id} />
              <input name="name" placeholder="Name" className={input} />
              <input name="email" type="email" placeholder="Email" className={input} />
              <input name="phone" placeholder="Phone" className={input} />
              <input name="role" placeholder="Role" className={input} />
              <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">Add contact</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-gray-900">Follow-up tasks</h2>
            <ul className="mt-2 space-y-1.5">
              {tks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <form action={toggleTask}>
                    <input type="hidden" name="taskId" value={t.id} />
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="done" value={(!t.done).toString()} />
                    <button className={`h-4 w-4 rounded border ${t.done ? "border-green-500 bg-green-500" : "border-gray-300"}`} aria-label="toggle" />
                  </form>
                  <span className={t.done ? "text-gray-400 line-through" : "text-gray-800"}>
                    {t.title}
                    {t.due_date && <span className="ml-1 text-xs text-gray-400">· {new Date(t.due_date).toLocaleDateString("en-GB")}</span>}
                  </span>
                </li>
              ))}
              {tks.length === 0 && <li className="text-xs text-gray-400">No tasks.</li>}
            </ul>
            <form action={addTask} className="mt-3 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
              <input type="hidden" name="id" value={id} />
              <input name="title" placeholder="Follow up…" className={`${input} flex-1`} />
              <input name="due_date" type="date" className="rounded-lg border border-gray-300 px-2 py-2 text-sm" />
              <button className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100">Add</button>
            </form>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-gray-900">Sequences</h2>
            <ul className="mt-2 space-y-1.5">
              {enrols.map((en) => (
                <li key={en.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-gray-700">
                    {en.prospect_sequences?.name ?? "Sequence"}
                    <span className="ml-1 text-xs text-gray-400">
                      · {en.status}{en.status === "active" ? ` (step ${en.step_index + 1})` : en.stopped_reason ? ` (${en.stopped_reason})` : ""}
                    </span>
                  </span>
                  {en.status === "active" && (
                    <form action={stopEnrolment}>
                      <input type="hidden" name="enrolId" value={en.id} />
                      <input type="hidden" name="companyId" value={id} />
                      <button className="rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-100">Stop</button>
                    </form>
                  )}
                </li>
              ))}
              {enrols.length === 0 && <li className="text-xs text-gray-400">Not in any sequence.</li>}
            </ul>
            <div className="mt-3 border-t border-gray-100 pt-3">
              <ProspectEnrol companyId={id} sequences={seqOpts} contacts={contactOpts} />
            </div>
          </section>
        </div>

        {/* Right: timeline + note */}
        <div className="lg:col-span-2">
          <section className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-gray-900">Send a message</h2>
            <ProspectComposer companyId={id} contacts={conts} />
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
            <h2 className="text-sm font-semibold text-gray-900">Activity</h2>
            <form action={addNote} className="mt-2 flex items-start gap-2">
              <input type="hidden" name="id" value={id} />
              <textarea name="body" rows={2} placeholder="Add a note…" className={`${input} flex-1`} />
              <button className="mt-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Note</button>
            </form>

            <ol className="mt-4 space-y-3 border-l border-gray-200 pl-4">
              {acts.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[1.32rem] top-1 h-2 w-2 rounded-full bg-gray-300" />
                  <p className="text-xs text-gray-400">
                    {a.type === "stage_change" ? "Stage" : a.type === "message" ? `${a.channel ?? "message"} ${a.direction ?? ""}` : a.type}
                    {" · "}
                    {new Date(a.created_at).toLocaleString("en-GB")}
                  </p>
                  {a.subject && <p className="text-sm font-medium text-gray-900">{a.subject}</p>}
                  {a.body && <p className="whitespace-pre-wrap text-sm text-gray-700">{a.body}</p>}
                </li>
              ))}
              {acts.length === 0 && <li className="text-xs text-gray-400">No activity yet.</li>}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
