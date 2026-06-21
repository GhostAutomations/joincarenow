import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteStep } from "@/modules/prospects/sequence-actions";
import { SequenceCreateForm, SequenceStepForm } from "@/components/dashboard/prospect-sequence-forms";

export default async function SequencesPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: sequences }, { data: steps }] = await Promise.all([
    db.from("prospect_sequences").select("id, name, channel, auto_send, active").order("created_at"),
    db.from("prospect_sequence_steps").select("id, sequence_id, position, delay_days, subject, body, high_risk").order("position"),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seqs = (sequences ?? []) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSteps = (steps ?? []) as any[];

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/sales" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to Sales
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Sequences</h1>
      <p className="mt-1 text-sm text-white/80">Templated follow-ups that send on a schedule and stop when a prospect replies or opts out.</p>

      <div className="mt-4">
        <SequenceCreateForm />
      </div>

      <div className="mt-6 space-y-4">
        {seqs.map((s) => {
          const mySteps = allSteps.filter((st) => st.sequence_id === s.id);
          return (
            <section key={s.id} className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{s.name}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-600">{s.channel}</span>
                {!s.auto_send && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">approval each step</span>}
              </div>
              <ol className="mt-2 space-y-1.5">
                {mySteps.map((st, i) => (
                  <li key={st.id} className="flex items-start justify-between gap-2 rounded-lg bg-gray-50 p-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500">
                        Step {i + 1} · wait {st.delay_days}d{st.high_risk ? " · needs approval" : ""}
                      </p>
                      {st.subject && <p className="font-medium text-gray-900">{st.subject}</p>}
                      <p className="whitespace-pre-wrap text-gray-700">{st.body}</p>
                    </div>
                    <form action={deleteStep}>
                      <input type="hidden" name="stepId" value={st.id} />
                      <button className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete step">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                ))}
                {mySteps.length === 0 && <li className="text-xs text-gray-400">No steps yet.</li>}
              </ol>
              <SequenceStepForm sequenceId={s.id} />
            </section>
          );
        })}
        {seqs.length === 0 && (
          <p className="text-sm text-white/70">No sequences yet — create one above.</p>
        )}
      </div>
    </div>
  );
}
