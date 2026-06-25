// Dependency-free report PDF: title, headline stats, and monospace tables.
// Standard fonts only (Helvetica, Helvetica-Bold, Courier) — no embedding.

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, " ");
}

export type ReportColumn = { header: string; width: number; align?: "left" | "right" };
export type ReportTable = { title?: string; columns: ReportColumn[]; rows: (string | number)[][] };

type Line = { text: string; font: "H" | "HB" | "C"; size: number; gapAfter?: number };

function pad(v: string | number, width: number, align?: "left" | "right"): string {
  let s = String(v ?? "");
  if (s.length > width) s = s.slice(0, width);
  return align === "right" ? s.padStart(width) : s.padEnd(width);
}

export function buildReportPdf(opts: {
  title: string;
  subtitle?: string;
  stats?: { label: string; value: string }[];
  tables?: ReportTable[];
  generatedAt?: string;
}): Uint8Array {
  const W = 595, H = 842, M = 48, LH = 13;
  const top = H - M;
  const maxLines = Math.floor((H - 2 * M) / LH);

  const lines: Line[] = [];
  lines.push({ text: opts.title, font: "HB", size: 16, gapAfter: 6 });
  if (opts.subtitle) lines.push({ text: opts.subtitle, font: "H", size: 10, gapAfter: 2 });
  lines.push({ text: `Generated ${opts.generatedAt ?? new Date().toLocaleString("en-GB")}`, font: "H", size: 8, gapAfter: 8 });

  if (opts.stats?.length) {
    for (const s of opts.stats) lines.push({ text: `${s.label}: ${s.value}`, font: "H", size: 10 });
    lines.push({ text: "", font: "H", size: 10, gapAfter: 6 });
  }

  for (const t of opts.tables ?? []) {
    if (t.title) lines.push({ text: t.title, font: "HB", size: 11, gapAfter: 2 });
    const header = t.columns.map((c) => pad(c.header, c.width, c.align)).join("  ");
    lines.push({ text: header, font: "HB", size: 9 });
    lines.push({ text: "-".repeat(header.length), font: "C", size: 9 });
    for (const row of t.rows) {
      lines.push({ text: t.columns.map((c, i) => pad(row[i] ?? "", c.width, c.align)).join("  "), font: "C", size: 9 });
    }
    lines.push({ text: "", font: "H", size: 9, gapAfter: 6 });
  }

  // Paginate.
  const pages: Line[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));

  const FONT: Record<string, string> = { H: "/F1", HB: "/F2", C: "/F3" };
  const contentStreams = pages.map((pageLines) => {
    let s = "BT\n";
    let y = top;
    for (const ln of pageLines) {
      s += `${FONT[ln.font]} ${ln.size} Tf\n1 0 0 1 ${M} ${y.toFixed(2)} Tm\n(${esc(ln.text)}) Tj\n`;
      y -= LH + (ln.gapAfter ?? 0);
    }
    s += "ET";
    return s;
  });

  const objects: string[] = [];
  const firstPageObj = 6;
  const pageObjNums = pages.map((_, i) => firstPageObj + i * 2);
  const kids = pageObjNums.map((nn) => `${nn} 0 R`).join(" ");

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  objects[5] = `<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>`;
  for (let i = 0; i < pages.length; i++) {
    const pageNum = firstPageObj + i * 2;
    const contentNum = pageNum + 1;
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentNum} 0 R >>`;
    const stream = contentStreams[i];
    objects[contentNum] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  const total = objects.length - 1;
  for (let nn = 1; nn <= total; nn++) {
    offsets[nn] = Buffer.byteLength(pdf, "latin1");
    pdf += `${nn} 0 obj\n${objects[nn]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${total + 1}\n0000000000 65535 f \n`;
  for (let nn = 1; nn <= total; nn++) pdf += `${String(offsets[nn]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
