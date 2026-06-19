"use client";

import { useState } from "react";
import { FileText, X, Printer, Download } from "lucide-react";

/** Load jsPDF from the CDN once (no npm dependency needed). */
function loadJsPdf(): Promise<new (opts?: Record<string, unknown>) => JsPdfDoc> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { jspdf?: { jsPDF: new (opts?: Record<string, unknown>) => JsPdfDoc } };
    if (w.jspdf?.jsPDF) return resolve(w.jspdf.jsPDF);
    const url = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    const existing = document.getElementById("jspdf-cdn") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.jspdf!.jsPDF));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = "jspdf-cdn";
    s.src = url;
    s.onload = () => resolve(w.jspdf!.jsPDF);
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

/** jsPDF's standard fonts only cover Latin-1 — map the characters the AI tends
 *  to use (box-drawing separators, smart quotes, dashes, bullets) to safe ones,
 *  otherwise they render as garbage (e.g. stray % signs). */
function pdfSafe(text: string): string {
  return text
    .replace(/[─-╿]/g, "-") // box-drawing separators ──── → hyphens
    .replace(/[‘’‚′]/g, "'") // smart single quotes
    .replace(/[“”„″]/g, '"') // smart double quotes
    .replace(/[–—]/g, "-") // en/em dash
    .replace(/[•●▪·]/g, "-") // bullets
    .replace(/ /g, " ") // non-breaking space
    .replace(/…/g, "...") // ellipsis
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, ""); // drop anything else outside Latin-1
}

type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (n: number) => void;
  splitTextToSize: (t: string, w: number) => string[];
  text: (t: string | string[], x: number, y: number) => void;
  addPage: () => void;
  addImage: (d: string, f: string, x: number, y: number, w: number, h: number) => void;
  save: (name: string) => void;
};

export type SignedDoc = {
  id: string;
  title: string;
  docType: string; // contract | policy
  signerName: string;
  signedAt: string;
  signatureMethod: string; // type | draw
  signatureImage: string | null;
  body: string;
  version: number | null;
};

export function SignedDocs({ docs }: { docs: SignedDoc[] }) {
  const [view, setView] = useState<SignedDoc | null>(null);

  if (docs.length === 0) {
    return <p className="text-sm text-gray-500">No signed documents yet.</p>;
  }

  return (
    <div>
      <ul className="divide-y divide-gray-100">
        {docs.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">{d.title}</p>
                <p className="text-xs text-gray-500">
                  Signed by {d.signerName} · {new Date(d.signedAt).toLocaleDateString("en-GB")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setView(d)}
              className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              View
            </button>
          </li>
        ))}
      </ul>

      {view && <DocViewer doc={view} onClose={() => setView(null)} />}
    </div>
  );
}

function DocViewer({ doc, onClose }: { doc: SignedDoc; onClose: () => void }) {
  const signedOn = new Date(doc.signedAt).toLocaleString("en-GB");
  const [pdfBusy, setPdfBusy] = useState(false);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const JsPDF = await loadJsPdf();
      const pdf = new JsPDF({ unit: "pt", format: "a4" });
      const margin = 48;
      const pageH = pdf.internal.pageSize.getHeight();
      const width = pdf.internal.pageSize.getWidth() - margin * 2;
      let y = margin;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      for (const line of pdf.splitTextToSize(pdfSafe(doc.title), width)) {
        pdf.text(line, margin, y);
        y += 20;
      }
      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      for (const line of pdf.splitTextToSize(pdfSafe(doc.body), width)) {
        if (y > pageH - margin) {
          pdf.addPage();
          y = margin;
        }
        pdf.text(line, margin, y);
        y += 15;
      }

      // Signature block
      if (y > pageH - 120) {
        pdf.addPage();
        y = margin;
      }
      y += 24;
      if (doc.signatureMethod === "draw" && doc.signatureImage) {
        try {
          pdf.addImage(doc.signatureImage, "PNG", margin, y, 160, 60);
          y += 72;
        } catch {
          /* ignore bad image */
        }
      } else {
        pdf.setFontSize(18);
        pdf.text(pdfSafe(doc.signerName), margin, y);
        y += 22;
      }
      pdf.setFontSize(9);
      pdf.setTextColor(110);
      pdf.text(pdfSafe(`Signed by ${doc.signerName} on ${signedOn}`), margin, y);

      pdf.save(`${doc.title}.pdf`);
    } catch {
      alert("Sorry, the PDF couldn't be generated. You can use Print → Save as PDF instead.");
    } finally {
      setPdfBusy(false);
    }
  }

  function printDoc() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const sig =
      doc.signatureMethod === "draw" && doc.signatureImage
        ? `<img src="${doc.signatureImage}" alt="signature" style="max-height:90px;border-bottom:1px solid #999" />`
        : `<div style="font-family:'Segoe Script',cursive;font-size:24px">${esc(doc.signerName)}</div>`;
    w.document.write(`<!doctype html><html><head><title>${esc(doc.title)}</title>
      <style>body{font-family:Georgia,serif;line-height:1.5;color:#111;padding:40px;max-width:720px;margin:auto}
      h1{font-size:20px} pre{white-space:pre-wrap;font-family:inherit;font-size:14px}
      .sig{margin-top:32px;border-top:1px solid #ddd;padding-top:16px}</style></head>
      <body><h1>${esc(doc.title)}</h1><pre>${esc(doc.body)}</pre>
      <div class="sig">${sig}<div style="font-size:12px;color:#555;margin-top:6px">
      Signed by ${esc(doc.signerName)} on ${esc(signedOn)}</div></div>
      <script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      <div className="absolute inset-0 bg-black/50" aria-hidden onClick={onClose} />
      <div className="relative mx-auto my-8 w-full max-w-2xl px-4">
        <div className="rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">{doc.title}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={printDoc}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={downloadPdf}
                disabled={pdfBusy}
                className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-60"
              >
                <Download className="h-4 w-4" /> {pdfBusy ? "Preparing…" : "PDF"}
              </button>
              <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{doc.body}</p>

            <div className="mt-6 border-t border-gray-200 pt-4">
              {doc.signatureMethod === "draw" && doc.signatureImage ? (
                <img src={doc.signatureImage} alt="Signature" className="max-h-24 border-b border-gray-300" />
              ) : (
                <p className="font-[cursive] text-2xl text-gray-900">{doc.signerName}</p>
              )}
              <p className="mt-1.5 text-xs text-gray-500">
                Signed by {doc.signerName} on {signedOn}
                {doc.version != null && ` · version ${doc.version}`}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
