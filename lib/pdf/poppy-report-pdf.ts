// Client-side Poppy report → PDF (jsPDF from CDN, no npm dep). Shared by the
// applicant panel "Download PDF" button and the staff-file ZIP.
import type { PoppyReportData } from "@/lib/ai/generate-poppy-report";

export type JsPdfDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFont: (f: string, s?: string) => void;
  setFontSize: (n: number) => void;
  setTextColor: (n: number) => void;
  splitTextToSize: (t: string, w: number) => string[];
  text: (t: string | string[], x: number, y: number) => void;
  addPage: () => void;
  output: (type: "arraybuffer") => ArrayBuffer;
};
export type JsPdfCtor = new (opts?: Record<string, unknown>) => JsPdfDoc;

export function loadJsPdf(): Promise<JsPdfCtor> {
  const w = window as unknown as { jspdf?: { jsPDF: JsPdfCtor } };
  return new Promise((resolve, reject) => {
    if (w.jspdf?.jsPDF) return resolve(w.jspdf.jsPDF);
    const id = "jspdf-cdn";
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.jspdf!.jsPDF));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = id;
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => resolve(w.jspdf!.jsPDF);
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

/** jsPDF standard fonts only cover Latin-1 — normalise smart punctuation etc. */
export function pdfSafe(text: string): string {
  return (text ?? "")
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/[•●▪·]/g, "-")
    .replace(/ /g, " ")
    .replace(/…/g, "...")
    .replace(/[^\x09\x0A\x0D\x20-\xFF]/g, "");
}

export function pdfSafeName(s: string): string {
  return (s || "document").replace(/[/\\:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Render a Poppy screening report to a PDF ArrayBuffer. */
export function poppyReportPdf(JsPDF: JsPdfCtor, report: PoppyReportData, applicantName: string): ArrayBuffer {
  const pdf = new JsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageH = pdf.internal.pageSize.getHeight();
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  const line = (text: string, size: number, style: "bold" | "normal", colour = 20, gap = 15) => {
    pdf.setFont("helvetica", style);
    pdf.setFontSize(size);
    pdf.setTextColor(colour);
    for (const l of pdf.splitTextToSize(pdfSafe(text), width)) {
      if (y > pageH - margin) { pdf.addPage(); y = margin; }
      pdf.text(l, margin, y);
      y += gap;
    }
  };

  line(`Poppy screening — ${applicantName}`, 16, "bold");
  y += 6;
  if (report.summary) { line(report.summary, 11, "normal"); y += 6; }
  if (report.recommendation) { line(`Recommendation: ${report.recommendation}`, 11, "bold"); y += 8; }

  if (report.concerns.length) {
    line("Worth checking", 12, "bold", 150);
    for (const c of report.concerns) line(`- ${c}`, 11, "normal");
    y += 8;
  }

  if (report.questions.length) {
    line("Screening questions & answers", 12, "bold", 60);
    report.questions.forEach((q, i) => {
      line(`Q${i + 1}. ${q.question}`, 11, "bold");
      if (q.answer) line(q.answer, 11, "normal");
      else if (q.rationale) line(`(${q.rationale})`, 9, "normal", 120);
      y += 4;
    });
  }

  return pdf.output("arraybuffer");
}
