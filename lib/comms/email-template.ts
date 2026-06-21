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

/** A light, deliverability-friendly branded HTML wrapper. Keep it minimal —
 *  a small header, the message, and a plain footer. */
export function renderEmailHtml(opts: {
  bodyText: string;
  heading?: string;       // wordmark text if no logo
  logoUrl?: string | null;
  brandColor?: string;    // hex
  footerNote?: string;
  unsubUrl?: string;
}): string {
  const brand = opts.brandColor || "#4f46e5";
  const header = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="" height="28" style="height:28px;width:auto;display:block"/>`
    : `<span style="font-size:16px;font-weight:700;color:${esc(brand)}">${esc(opts.heading || "Join Care Now")}</span>`;

  const footer = [
    opts.footerNote ? `<div style="margin-bottom:6px">${esc(opts.footerNote)}</div>` : "",
    opts.unsubUrl ? `<a href="${esc(opts.unsubUrl)}" style="color:#888;text-decoration:underline">Unsubscribe</a>` : "",
  ].join("");

  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
<tr><td style="padding:18px 24px;border-bottom:1px solid #f0f0f0">${header}</td></tr>
<tr><td style="padding:22px 24px;font-size:15px;color:#111">${bodyToHtml(opts.bodyText)}</td></tr>
${footer ? `<tr><td style="padding:14px 24px;border-top:1px solid #f0f0f0;font-size:12px;color:#888">${footer}</td></tr>` : ""}
</table>
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
