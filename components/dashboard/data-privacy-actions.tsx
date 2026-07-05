"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ShieldAlert } from "lucide-react";
import { exportApplicantData, eraseApplicant } from "@/modules/privacy/actions";

type JsZipInstance = {
  file: (name: string, data: string | ArrayBuffer) => void;
  generateAsync: (opts: { type: "blob" }) => Promise<Blob>;
};
type JsZipCtor = new () => JsZipInstance;

function loadJsZip(): Promise<JsZipCtor> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { JSZip?: JsZipCtor };
    if (w.JSZip) return resolve(w.JSZip);
    const existing = document.getElementById("jszip-cdn") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.JSZip as JsZipCtor));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = "jszip-cdn";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
    s.onload = () => resolve(w.JSZip as JsZipCtor);
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

function fname(s: string): string {
  return (s || "applicant").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 60);
}

export function DataPrivacyActions({
  applicantId,
  name,
  isAdmin,
}: {
  applicantId: string;
  name: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "export" | "erase">(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy("export");
    setError(null);
    try {
      const res = await exportApplicantData(applicantId);
      if (res.error || !res.data) {
        setError(res.error ?? "Could not build the export.");
        return;
      }
      const JSZip = await loadJsZip();
      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(res.data, null, 2));
      for (let i = 0; i < (res.files ?? []).length; i++) {
        const f = res.files![i];
        try {
          const r = await fetch(f.url);
          if (r.ok) zip.file(`files/${String(i + 1).padStart(2, "0")} ${f.filename}`, await r.arrayBuffer());
        } catch {
          /* skip unreachable file */
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fname(name)}-data-export.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not build the export. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  async function onErase() {
    setBusy("erase");
    setError(null);
    try {
      const res = await eraseApplicant(applicantId);
      if (res.error) {
        setError(res.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not erase. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button
          onClick={onExport}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/50 bg-white/70 px-3 py-1.5 text-xs font-medium text-gray-700 backdrop-blur hover:bg-white/90 disabled:opacity-60"
          title="Export all data held about this person (Subject Access Request)"
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          {busy === "export" ? "Exporting…" : "Export data"}
        </button>
        {isAdmin && !confirming && (
          <button
            onClick={() => { setConfirming(true); setError(null); }}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"
            title="Permanently erase all data held about this person"
          >
            <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
            Erase data
          </button>
        )}
      </div>

      {isAdmin && confirming && (
        <div className="mt-1 rounded-lg border border-red-200 bg-red-50 p-2 text-right">
          <p className="text-xs text-red-700">
            Permanently delete everything your company holds about {name}? This cannot be undone.
          </p>
          <div className="mt-1.5 flex items-center justify-end gap-2">
            <button
              onClick={() => setConfirming(false)}
              disabled={busy !== null}
              className="rounded-lg border border-white/50 bg-white/70 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white/90 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              onClick={onErase}
              disabled={busy !== null}
              className="rounded-lg bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {busy === "erase" ? "Erasing…" : "Erase permanently"}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
