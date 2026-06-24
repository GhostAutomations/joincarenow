// Minimal, dependency-free PDF writer for the signed subscription agreement.
// Uses the standard Helvetica fonts (no embedding needed) and paginates the
// agreement text. Kept deliberately small — it only needs to render wrapped
// text + a signature block, not arbitrary documents.

function esc(s: string): string {
  // Escape PDF string delimiters and non-ASCII (WinAnsi-safe-ish).
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7e]/g, " ");
}

/** Greedy word-wrap to a max character count (approx for 10pt Helvetica). */
function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split("\n")) {
    if (rawLine.trim() === "") { out.push(""); continue; }
    let line = "";
    for (const word of rawLine.split(/\s+/)) {
      if (line === "") { line = word; }
      else if ((line + " " + word).length <= max) { line += " " + word; }
      else { out.push(line); line = word; }
      // Hard-break very long words.
      while (line.length > max) { out.push(line.slice(0, max)); line = line.slice(max); }
    }
    out.push(line);
  }
  return out;
}

type SignedAgreement = {
  title: string;
  bodyText: string;
  companyName: string;
  planLabel: string;
  offer?: string | null;
  signerName: string;
  signerEmail?: string | null;
  signedAt: string; // ISO
};

export function buildAgreementPdf(a: SignedAgreement): Uint8Array {
  const W = 595, H = 842, M = 50, FS = 10, LH = 14;
  const top = H - M;
  const maxLines = Math.floor((H - 2 * M) / LH);
  const wrapCols = 92;

  // Build the full line list. (null = a heading line rendered bold-ish bigger.)
  const lines: { text: string; heading?: boolean }[] = [];
  lines.push({ text: a.title, heading: true });
  lines.push({ text: "" });
  for (const ln of wrap(a.bodyText, wrapCols)) lines.push({ text: ln });
  lines.push({ text: "" });
  lines.push({ text: "" });
  lines.push({ text: "Signed", heading: true });
  const dt = new Date(a.signedAt);
  const when = isNaN(dt.getTime()) ? a.signedAt : dt.toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });
  lines.push({ text: `Company: ${a.companyName}` });
  lines.push({ text: `Plan: ${a.planLabel}` });
  if (a.offer) lines.push({ text: `Agreed offer: ${a.offer}` });
  lines.push({ text: `Signed by: ${a.signerName}${a.signerEmail ? ` (${a.signerEmail})` : ""}` });
  lines.push({ text: `Date: ${when}` });
  lines.push({ text: "" });
  lines.push({ text: "Accepted electronically by typing the signer's name and confirming agreement." });

  // Paginate.
  const pages: { text: string; heading?: boolean }[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));

  // Build content stream for each page.
  const contentStreams = pages.map((pageLines) => {
    let s = "BT\n";
    let y = top;
    for (const ln of pageLines) {
      const size = ln.heading ? 14 : FS;
      const font = ln.heading ? "/F2" : "/F1";
      s += `${font} ${size} Tf\n1 0 0 1 ${M} ${y.toFixed(2)} Tm\n(${esc(ln.text)}) Tj\n`;
      y -= ln.heading ? LH + 6 : LH;
    }
    s += "ET";
    return s;
  });

  // Assemble objects: 1 Catalog, 2 Pages, 3 F1, 4 F2, then per page: Page + Content.
  const objects: string[] = [];
  const pageObjNums: number[] = [];
  const firstPageObj = 5;
  for (let i = 0; i < pages.length; i++) pageObjNums.push(firstPageObj + i * 2);
  const kids = pageObjNums.map((n) => `${n} 0 R`).join(" ");

  objects[1] = `<< /Type /Catalog /Pages 2 0 R >>`;
  objects[2] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;
  objects[3] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>`;
  objects[4] = `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>`;
  for (let i = 0; i < pages.length; i++) {
    const pageNum = firstPageObj + i * 2;
    const contentNum = pageNum + 1;
    objects[pageNum] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNum} 0 R >>`;
    const stream = contentStreams[i];
    objects[contentNum] = `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`;
  }

  // Serialise with a correct xref table.
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  const total = objects.length - 1; // objects are 1-indexed
  for (let n = 1; n <= total; n++) {
    offsets[n] = Buffer.byteLength(pdf, "latin1");
    pdf += `${n} 0 obj\n${objects[n]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${total + 1}\n`;
  pdf += `0000000000 65535 f \n`;
  for (let n = 1; n <= total; n++) {
    pdf += `${String(offsets[n]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Uint8Array(Buffer.from(pdf, "latin1"));
}
