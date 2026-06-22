import Link from "next/link";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSendWindow } from "@/lib/prospects/send-window";
import { getAutoSendMode } from "@/lib/prospects/ai-drafts";
import { setSendWindow } from "@/modules/prospects/actions";
import { AutoSendToggle } from "@/components/dashboard/autosend-toggle";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default async function CrmSettingsPage() {
  await requirePlatformAdmin();
  const db = createAdminClient();
  const [win, autoSendMode] = await Promise.all([getSendWindow(db), getAutoSendMode(db)]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-white drop-shadow-sm">CRM settings</h1>
        <Link href="/admin/sales" className="rounded-lg border border-white/40 bg-white/20 px-3 py-1.5 text-sm font-medium text-white backdrop-blur hover:bg-white/30">
          ← Back to Sales
        </Link>
      </div>

      {/* Sending hours */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Agent sending hours</h2>
        <p className="mt-1 text-sm text-gray-600">
          The AI reply agent and sequences only send emails and SMS between these times
          (UK time). Nothing is sent outside the window — it waits until the next morning.
        </p>
        <form action={setSendWindow} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium text-gray-700">
            From
            <select name="start_hour" defaultValue={win.start} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">
            Until
            <select name="end_hour" defaultValue={win.end} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Save hours
          </button>
        </form>
        <p className="mt-3 text-xs text-gray-500">
          Currently sending {hourLabel(win.start)}–{hourLabel(win.end)} UK time. The reply
          agent checks for new replies every 20 minutes within this window.
        </p>
      </section>

      {/* AI auto-send */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">AI auto-send</h2>
        <p className="mt-1 text-sm text-gray-600">
          Controls whether AI-written replies send automatically or wait for your approval.
          Opted-out and suppressed contacts are never messaged, whatever this is set to.
        </p>
        <div className="mt-4">
          <AutoSendToggle mode={autoSendMode} />
        </div>
      </section>
    </div>
  );
}
