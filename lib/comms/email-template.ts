function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn a plain-text body into simple HTML paragraphs (preserving line breaks). */
function bodyToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 14px;line-height:1.55">${esc(para).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Slightly darken a hex colour for gradients/contrast (each channel × factor). */
function shade(hex: string, factor: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A branded, deliverability-friendly HTML email: coloured header band with the
 *  company wordmark/logo, the message, an optional call-to-action button, and a
 *  light footer. Renders well across major email clients (table-based, inline). */
export function renderEmailHtml(opts: {
  bodyText: string;
  heading?: string; // wordmark text if no logo
  logoUrl?: string | null;
  brandColor?: string; // hex
  footerNote?: string;
  unsubUrl?: string;
  cta?: { label: string; url: string };
  // Multiple side-by-side buttons (e.g. Accept / Decline). Takes precedence over cta.
  ctas?: { label: string; url: string; style?: "primary" | "danger" | "ghost" }[];
}): string {
  const brand = opts.brandColor || "#0d1d4b"; // JCN navy
  const brandDark = shade(brand, 0.82);
  const headerInner = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="${esc(opts.heading || "Join Care Now")}" height="30" style="height:30px;width:auto;display:block"/>`
    : `<span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.01em">${esc(opts.heading || "Join Care Now")}</span>`;

  const btnCell = (b: { label: string; url: string; style?: "primary" | "danger" | "ghost" }) => {
    const bg = b.style === "danger" ? "#dc2626" : b.style === "ghost" ? "#ffffff" : brand;
    const fg = b.style === "ghost" ? "#374151" : "#ffffff";
    const border = b.style === "ghost" ? "border:1px solid #d1d5db;" : "";
    return `<td style="padding:0 6px 0 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border-radius:10px;background:${bg};${border}">
<a href="${esc(b.url)}" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:600;color:${fg};text-decoration:none;border-radius:10px">${esc(b.label)}</a>
</td></tr></table></td>`;
  };

  const buttons = opts.ctas?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px"><tr>${opts.ctas.map(btnCell).join("")}</tr></table>`
    : opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 6px"><tr>${btnCell(opts.cta)}</tr></table>`
    : "";
  const button = buttons;

  const footer = [
    opts.footerNote ? `<div style="margin-bottom:6px">${esc(opts.footerNote)}</div>` : "",
    opts.unsubUrl ? `<a href="${esc(opts.unsubUrl)}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a>` : "",
  ].join("");

  return `<!doctype html><html><body style="margin:0;background:#eef2f1;padding:28px 16px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;border:1px solid #e5e7eb;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06)">
<tr><td style="padding:20px 28px;background:linear-gradient(135deg,${esc(brand)},${esc(brandDark)});background-color:${esc(brand)}">${headerInner}</td></tr>
<tr><td style="padding:26px 28px 8px;font-size:15px;line-height:1.6;color:#1f2937">${bodyToHtml(opts.bodyText)}${button}</td></tr>
<tr><td style="height:8px"></td></tr>
${footer ? `<tr><td style="padding:16px 28px;border-top:1px solid #f0f0f0;font-size:12px;color:#9ca3af;background:#fafafa">${footer}</td></tr>` : ""}
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px"><tr><td style="padding:14px 8px;text-align:center;font-size:11px;color:#9ca3af">Sent by Join Care Now · joincarenow.com</td></tr></table>
</td></tr></table>
</body></html>`;
}

/** Build the plain-text + light-branded HTML pair for a prospect (cold) email. */
export function buildProspectEmail(coreBody: string, unsubUrl: string): { text: string; html: string } {
  const text = `${coreBody}\n\n—\nTo opt out, click here: ${unsubUrl}`;
  const html = renderEmailHtml({
    bodyText: coreBody,
    heading: "Join Care Now",
    footerNote: "You're receiving this because we think Join Care Now could help your service.",
    unsubUrl,
  });
  return { text, html };
}
