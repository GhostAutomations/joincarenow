// Dependency-free PDF writer for a single document (title + body text). Uses the
// standard Helvetica fonts (no embedding) and paginates wrapped text. Mirrors the
// approach in lib/agreements/pdf.ts, generalised for contracts / policies / JDs.

function esc(s: string): string {
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
      while (line.length > max) { out.push(line.slice(0, max)); line = line.slice(max); }
    }
    out.push(line);
  }
  return out;
}

/** Build a simple, multi-page PDF from a title and body text. `footer` (optional)
 *  is printed once at the end (e.g. a generated-on line). */
export function buildDocumentPdf(title: string, bodyText: string, footer?: string): Uint8Array {
  const W = 595, H = 842, M = 50, FS = 11, LH = 15;
  const top = H - M;
  const maxLines = Math.floor((H - 2 * M) / LH);
  const wrapCols = 88;

  const lines: { text: string; heading?: boolean }[] = [];
  lines.push({ text: title, heading: true });
  lines.push({ text: "" });
  for (const ln of wrap(bodyText, wrapCols)) lines.push({ text: ln });
  if (footer) {
    lines.push({ text: "" });
    lines.push({ text: "" });
    lines.push({ text: footer });
  }

  // Paginate.
  const pages: { text: string; heading?: boolean }[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) pages.push(lines.slice(i, i + maxLines));
  if (pages.length === 0) pages.push([{ text: title, heading: true }]);

  const contentStreams = pages.map((pageLines) => {
    let s = "BT\n";
    let y = top;
    for (const ln of pageLines) {
      const size = ln.heading ? 16 : FS;
      const font = ln.heading ? "/F2" : "/F1";
      s += `${font} ${size} Tf\n1 0 0 1 ${M} ${y.toFixed(2)} Tm\n(${esc(ln.text)}) Tj\n`;
      y -= ln.heading ? LH + 8 : LH;
    }
    s += "ET";
    return s;
  });

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

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  const total = objects.length - 1;
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

/**
 * Fill a template's merge fields for a standalone (no-applicant) PDF so no raw
 * `{{tokens}}` remain — company fields get real values, person/offer fields get
 * a clear bracketed placeholder, and anything else is humanised to a label.
 */
export function fillTemplateForDownload(body: string, opts: { companyName: string }): string {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const known: Record<string, string> = {
    company_name: opts.companyName,
    company: opts.companyName,
    date: today,
    today: today,
    first_name: "[First name]",
    last_name: "[Last name]",
    name: "[Full name]",
    full_name: "[Full name]",
    role: "[Role]",
    job_title: "[Role]",
    pay: "[Pay]",
    salary: "[Pay]",
    hours: "[Hours]",
    start_date: "[Start date]",
  };
  return (body || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, raw: string) => {
    const key = String(raw).toLowerCase().trim();
    if (key in known) return known[key];
    // Humanise an unknown token: {{some_field}} -> [Some field]
    const words = key.replace(/[._]+/g, " ").trim();
    return `[${words.charAt(0).toUpperCase()}${words.slice(1)}]`;
  });
}
