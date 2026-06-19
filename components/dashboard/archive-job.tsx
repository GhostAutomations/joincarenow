"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { archiveJob } from "@/modules/jobs/actions";

/** Archive button with an inline warning + the guard error (if applicants are
 *  still in progress) shown beneath it. */
export function ArchiveJobButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("id", id);
    const r = await archiveJob(fd);
    setBusy(false);
    if (r?.error) {
      setError(r.error);
      setConfirming(false);
      return;
    }
    router.push("/jobs");
    router.refresh();
  }

  return (
    <div className="w-full">
      {!confirming ? (
        <button
          onClick={() => {
            setConfirming(true);
            setError(null);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          <Archive className="h-4 w-4" aria-hidden />
          Archive job
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            Archiving moves this job and its pipeline out of view into the Archived section.
            You can reopen it later. Continue?
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={go}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
            >
              <Archive className="h-4 w-4" aria-hidden />
              {busy ? "Archiving…" : "Yes, archive"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
