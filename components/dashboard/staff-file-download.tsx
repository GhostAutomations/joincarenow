"use client";

import { useState } from "react";
import { FolderDown } from "lucide-react";
import { getStaffFile } from "@/modules/employees/actions";
import { poppyReportPdf } from "@/lib/pdf/poppy-report-pdf";

/* ---- CDN loaders (no npm deps — mirrors signed-docs.tsx) ---- */
type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (n: number) => void;
  splitTextToSize: (t: string, w: number) => string[];
  text: (t: string | string[], x: number, y: number) => void;
  addPage: () => void;
  addImage: (d: string, f: string, x: number, y: number, w: number, h: number) => void;
  output: (type: "arraybuffer") => ArrayBuffer;
};
type JsPdfCtor = new (opts?: Record<string, unknown>) => JsPdfDoc;
type JsZipInstance = {
  folder: (name: string) => { file: (name: string, data: ArrayBuffer) => void };
  generateAsync: (opts: { type: "blob" }) => Promise<Blob>;
};
type JsZipCtor = new () => JsZipInstance;

function loadScript(id: string, src: string, getter: () => unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    const val = getter();
    if (val) return resolve(val);
    if (existing) {
      existing.addEventListener("load", () => resolve(getter()));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = src;
    s.onload = () => resolve(getter());
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

function loadJsPdf(): Promise<JsPdfCtor> {
  const w = window as unknown as { jspdf?: { jsPDF: JsPdfCtor } };
  return loadScript("jspdf-cdn", "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js", () => w.jspdf?.jsPDF) as Promise<JsPdfCtor>;
}
function loadJsZip(): Promise<JsZipCtor> {
  const w = window as unknown as { JSZip?: JsZipCtor };
  return loadScript("jszip-cdn", "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js", () => w.JSZip) as Promise<JsZipCtor>;
}

/** jsPDF standard fonts only cover Latin-1 — normalise smart punctuation etc. */
function pdfSafe(text: string): string {
  return (text ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●▪·]/g, "-")
    .replace(/ /g, " ")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

function safe(s: string): string {
  return (s || "document").replace(/[\/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
}

type StaffFile = Awaited<ReturnType<typeof getStaffFile>>;

function signedDocPdf(JsPDF: JsPdfCtor, doc: NonNullable<StaffFile["signedDocs"]>[number]): ArrayBuffer {
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  for (const line of pdf.splitTextToSize(pdfSafe(doc.title), width)) { pdf.text(line, margin, y); y += 20; }
  y += 6;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  for (const line of pdf.splitTextToSize(pdfSafe(doc.body), width)) {
    if (y > pageH - margin) { pdf.addPage(); y = margin; }
    pdf.text(line, margin, y); y += 15;
  }

  if (y > pageH - 120) { pdf.addPage(); y = margin; }
  y += 24;
  if (doc.signatureMethod === "draw" && doc.signatureImage) {
    try { pdf.addImage(doc.signatureImage, "PNG", margin, y, 160, 60); y += 72; } catch { /* ignore */ }
  } else {
    pdf.setFontSize(18);
    pdf.text(pdfSafe(doc.signerName), margin, y); y += 22;
  }
  pdf.setFontSize(9);
  pdf.setTextColor(110);
  pdf.text(pdfSafe(`Signed by ${doc.signerName} on ${new Date(doc.signedAt).toLocaleString("en-GB")}`), margin, y);
  return pdf.output("arraybuffer");
}

function formPdf(JsPDF: JsPdfCtor, form: NonNullable<StaffFile["forms"]>[number]): ArrayBuffer {
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text(pdfSafe(form.name), margin, y); y += 20;
  if (form.submittedAt) {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setTextColor(110);
    pdf.text(pdfSafe(`Submitted ${new Date(form.submittedAt).toLocaleString("en-GB")}`), margin, y); y += 18;
  }
  pdf.setTextColor(20);
  for (const f of form.fields) {
    if (y > pageH - margin) { pdf.addPage(); y = margin; }
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(10);
    for (const line of pdf.splitTextToSize(pdfSafe(f.label), width)) { pdf.text(line, margin, y); y += 13; }
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(11);
    for (const line of pdf.splitTextToSize(pdfSafe(f.value || "—"), width)) {
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.text(line, margin, y); y += 15;
    }
    y += 6;
  }
  return pdf.output("arraybuffer");
}

export function StaffFileDownload({ employeeId }: { employeeId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const data = await getStaffFile(employeeId);
      if (data.error) { setError(data.error); return; }

      const [JsPDF, JSZip] = await Promise.all([loadJsPdf(), loadJsZip()]);
      const zip = new JSZip();

      const signed = zip.folder("Signed documents");
      (data.signedDocs ?? []).forEach((d, i) => {
        try { signed.file(`${String(i + 1).padStart(2, "0")} ${safe(d.title)}.pdf`, signedDocPdf(JsPDF, d)); } catch { /* skip */ }
      });

      const formsFolder = zip.folder("Forms");
      (data.forms ?? []).forEach((f, i) => {
        try { formsFolder.file(`${String(i + 1).padStart(2, "0")} ${safe(f.name)}.pdf`, formPdf(JsPDF, f)); } catch { /* skip */ }
      });

      if (data.poppyReport) {
        try {
          zip.folder("Screening").file(`Poppy screening.pdf`, poppyReportPdf(JsPDF, data.poppyReport, data.fullName ?? "Applicant"));
        } catch { /* skip */ }
      }

      const uploads = zip.folder("Uploads");
      for (let i = 0; i < (data.files ?? []).length; i++) {
        const f = data.files![i];
        try {
          const res = await fetch(f.url);
          if (res.ok) uploads.file(`${String(i + 1).padStart(2, "0")} ${f.filename}`, await res.arrayBuffer());
        } catch { /* skip unreachable file */ }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe(data.employeeRef ?? "employee")}-staff-file.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Could not build the staff file. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={download}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-white/40 bg-white/20 px-4 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30 disabled:opacity-60"
      >
        <FolderDown className="h-4 w-4" aria-hidden />
        {busy ? "Building staff file…" : "Download staff file"}
      </button>
      {error && <p className="text-xs text-red-200">{error}</p>}
    </div>
  );
}
