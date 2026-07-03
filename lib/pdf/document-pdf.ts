import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

/** #rrggbb -> pdf-lib rgb() (falls back to a neutral dark if unparseable). */
function hexRgb(hex: string, fallback: [number, number, number] = [0.1, 0.1, 0.12]) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex?.trim() ?? "");
  if (!m) return rgb(...fallback);
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Map smart punctuation to ASCII and drop anything outside WinAnsi so pdf-lib's
 *  standard fonts never throw on an unencodable glyph. */
function sanitize(s: string): string {
  return (s || "")
    .replace(/[‘’′]/g, "'")
    .replace(/[“”″]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/•/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\t\n\x20-\x7E -ÿ]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const raw of text.split("\n")) {
    if (raw.trim() === "") { out.push(""); continue; }
    let line = "";
    for (const word of raw.split(/\s+/)) {
      const trial = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= maxWidth) { line = trial; continue; }
      if (line) out.push(line);
      // Hard-break an over-long single word.
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth && w.length > 1) {
        let cut = w.length;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        out.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      line = w;
    }
    out.push(line);
  }
  return out;
}

export type DocPdfInput = {
  title: string;
  body: string;
  companyName: string;
  brandHex?: string;        // e.g. "#009051"
  logo?: { bytes: Uint8Array; kind: "png" | "jpg" } | null;
  footerMeta?: string;      // e.g. "Generated 3 July 2026 · Thistle Care Ltd"
};

/**
 * Render a contract / policy / job description to a branded, well-typeset PDF:
 * company logo + name header, brand-coloured title and section headings, real
 * dividers, bullet lists and page numbers.
 */
export async function buildDocumentPdf(input: DocPdfInput): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo: PDFImage | null = null;
  if (input.logo?.bytes?.length) {
    try {
      logo = input.logo.kind === "png" ? await pdf.embedPng(input.logo.bytes) : await pdf.embedJpg(input.logo.bytes);
    } catch {
      logo = null; // bad/unsupported image — render without it
    }
  }

  const brand = hexRgb(input.brandHex ?? "");
  const ink = rgb(0.13, 0.14, 0.16);
  const muted = rgb(0.45, 0.47, 0.5);
  const rule = rgb(0.85, 0.86, 0.88);

  const W = 595.28, H = 841.89, M = 56;
  const contentW = W - 2 * M;
  const bottomLimit = M + 26; // leave room for the footer

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const ensure = (need: number) => { if (y - need < bottomLimit) newPage(); };

  // ---- Header (first page): logo + company name + rule ----
  if (logo) {
    const maxH = 40, maxW = 150;
    const scale = Math.min(maxW / logo.width, maxH / logo.height, 1);
    const lw = logo.width * scale, lh = logo.height * scale;
    page.drawImage(logo, { x: M, y: y - lh, width: lw, height: lh });
    if (input.companyName) {
      page.drawText(sanitize(input.companyName), {
        x: M + lw + 12, y: y - lh / 2 - 6, size: 13, font: bold, color: brand,
      });
    }
    y -= lh + 14;
  } else if (input.companyName) {
    page.drawText(sanitize(input.companyName), { x: M, y: y - 14, size: 15, font: bold, color: brand });
    y -= 28;
  }
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 1.2, color: brand });
  y -= 26;

  // ---- Title ----
  for (const ln of wrap(sanitize(input.title), bold, 20, contentW)) {
    ensure(26);
    page.drawText(ln, { x: M, y: y - 20, size: 20, font: bold, color: ink });
    y -= 26;
  }
  if (input.footerMeta) {
    y -= 2;
    page.drawText(sanitize(input.footerMeta), { x: M, y: y - 10, size: 8.5, font, color: muted });
    y -= 20;
  } else {
    y -= 10;
  }

  // ---- Body ----
  const drawText = (
    text: string, size: number, f: PDFFont, color: ReturnType<typeof rgb>, lh: number, indent = 0, hanging = 0
  ) => {
    const lines = wrap(text, f, size, contentW - indent);
    lines.forEach((ln, i) => {
      ensure(lh);
      const x = M + indent + (i === 0 ? 0 : hanging);
      page.drawText(ln, { x, y: y - size, size, font: f, color });
      y -= lh;
    });
  };

  for (const rawLine of input.body.split("\n")) {
    const line = sanitize(rawLine).replace(/\s+$/, "");
    const t = line.trim();

    if (t === "") { y -= 6; continue; }                 // blank -> small gap
    if (/^-{3,}$/.test(t)) {                             // divider -> rule
      y -= 6; ensure(10);
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.75, color: rule });
      y -= 12; continue;
    }
    if (/^\d+\.\d+\s+\S/.test(t)) {                      // sub-heading e.g. "4.1 ..."
      y -= 6; drawText(t, 11.5, bold, ink, 15); y -= 2; continue;
    }
    const isNumberedH1 = /^\d+\.\s+\S/.test(t);
    const isCapsH1 = /[A-Z]/.test(t) && !/[a-z]/.test(t) && t.replace(/[^A-Za-z]/g, "").length > 2;
    if (isNumberedH1 || isCapsH1) {                     // section heading
      y -= 10; drawText(t, 13, bold, brand, 16); y -= 3; continue;
    }
    if (/^[-*]\s+/.test(t)) {                            // bullet
      drawText(`•  ${t.replace(/^[-*]\s+/, "")}`, 10.5, font, ink, 14, 10, 12); continue;
    }
    drawText(t, 10.5, font, ink, 14.5);                 // paragraph
  }

  // ---- Footer: page numbers + generated meta ----
  const pages = pdf.getPages();
  pages.forEach((p: PDFPage, i: number) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    const tw = font.widthOfTextAtSize(label, 8);
    p.drawText(label, { x: (W - tw) / 2, y: 30, size: 8, font, color: muted });
    if (input.footerMeta) p.drawText(sanitize(input.footerMeta), { x: M, y: 30, size: 8, font, color: muted });
  });

  return pdf.save();
}
