"use client";

import { useState } from "react";
import { Copy, Check, Linkedin, Facebook, Users, QrCode, Link2, MessageCircle } from "lucide-react";

/** qrcode-generator loaded from the CDN once (no npm dependency needed — mirrors
 *  the jsPDF loader in signed-docs.tsx). Returns the global `qrcode` factory. */
type QrFactory = (typeNumber: number, ecc: string) => {
  addData: (s: string) => void;
  make: () => void;
  createSvgTag: (opts: { cellSize?: number; margin?: number; scalable?: boolean }) => string;
};

function loadQr(): Promise<QrFactory> {
  return new Promise((resolve, reject) => {
    const w = window as unknown as { qrcode?: QrFactory };
    if (w.qrcode) return resolve(w.qrcode);
    const existing = document.getElementById("qrcode-cdn") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(w.qrcode!));
      existing.addEventListener("error", () => reject(new Error("load failed")));
      return;
    }
    const s = document.createElement("script");
    s.id = "qrcode-cdn";
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js";
    s.onload = () => resolve(w.qrcode!);
    s.onerror = () => reject(new Error("load failed"));
    document.body.appendChild(s);
  });
}

export type JobPromoteProps = {
  companyName: string;
  jobTitle: string;
  location: string | null;
  salary: string | null;
  employmentType: string | null;
  jobUrl: string; // full public careers URL
  brandPrimary: string | null;
  logoUrl: string | null;
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function JobPromote(props: JobPromoteProps) {
  const { companyName, jobTitle, location, salary, employmentType, jobUrl } = props;
  const brand = props.brandPrimary && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(props.brandPrimary) ? props.brandPrimary : "#2d6d6a";

  const [copied, setCopied] = useState<string | null>(null);
  const [posterErr, setPosterErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const where = location ? ` in ${location}` : "";
  const detailLine = [employmentType, salary].filter(Boolean).join(" · ");

  const linkedinPost =
    `We're hiring: ${jobTitle} at ${companyName}${where}.\n\n` +
    `${detailLine ? detailLine + "\n\n" : ""}` +
    `If you're passionate about delivering great care, we'd love to hear from you. ` +
    `Find out more and apply here:\n${jobUrl}\n\n#CareJobs #Hiring #SocialCare`;

  const facebookPost =
    `📢 Join our team! We're looking for a ${jobTitle}${where}.\n\n` +
    `${detailLine ? detailLine + "\n" : ""}` +
    `Know someone who'd be perfect? Share this post. Apply here:\n${jobUrl}`;

  const staffMessage =
    `Hi team — we're recruiting a ${jobTitle}${where} and would love your help spreading the word. ` +
    `If you know someone who'd be a great fit, please share this link with them:\n${jobUrl}\n\nThank you!`;

  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
    } catch {
      setCopied(null);
    }
  }

  // Facebook removed caption pre-fill from its share dialog, so copy the
  // ready-made caption to the clipboard first, then open the sharer with the
  // job link — the manager just pastes and posts.
  async function shareFacebook() {
    try {
      await navigator.clipboard.writeText(facebookPost);
      setCopied("fb-share");
      setTimeout(() => setCopied((c) => (c === "fb-share" ? null : c)), 4000);
    } catch {
      /* clipboard may be blocked; still open the dialog */
    }
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(jobUrl)}`,
      "_blank",
      "noopener,width=670,height=620"
    );
  }

  // LinkedIn (like Facebook) can't pre-fill the caption — copy it, then open the
  // share dialog with the job link to paste into.
  async function shareLinkedIn() {
    try {
      await navigator.clipboard.writeText(linkedinPost);
      setCopied("li-share");
      setTimeout(() => setCopied((c) => (c === "li-share" ? null : c)), 4000);
    } catch {
      /* clipboard may be blocked; still open the dialog */
    }
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(jobUrl)}`,
      "_blank",
      "noopener,width=670,height=620"
    );
  }

  // WhatsApp DOES allow a pre-filled message, so this is a true one-tap share —
  // opens WhatsApp with the staff referral message + link ready to send.
  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(staffMessage)}`, "_blank", "noopener");
  }

  async function openPoster() {
    setPosterErr(null);
    // Open the window synchronously on the click so pop-up blockers (Safari)
    // don't kill it after the async QR load below.
    const win = window.open("", "_blank");
    if (!win) {
      setPosterErr("Pop-up blocked — allow pop-ups for this site, then try again.");
      return;
    }
    win.document.write("<p style='font:15px -apple-system,Segoe UI,Roboto,sans-serif;padding:24px;color:#374151'>Building your poster…</p>");
    setBusy(true);
    try {
      const qrcode = await loadQr();
      const qr = qrcode(0, "M");
      qr.addData(jobUrl);
      qr.make();
      const svg = qr.createSvgTag({ cellSize: 8, margin: 1, scalable: true });

      const logo = props.logoUrl
        ? `<img src="${esc(props.logoUrl)}" alt="${esc(companyName)}" style="max-height:64px;max-width:240px;object-fit:contain"/>`
        : `<div style="font-size:26px;font-weight:800;color:${brand}">${esc(companyName)}</div>`;

      const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(jobTitle)} — poster</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { margin: 0; font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2937; }
  .sheet { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 22mm 18mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .bar { height: 8px; width: 100%; background: ${brand}; border-radius: 6px; }
  .logo { margin: 26px 0 10px; min-height: 64px; display: flex; align-items: center; }
  .kicker { letter-spacing: .22em; text-transform: uppercase; font-size: 13px; color: ${brand}; font-weight: 700; margin-top: 18px; }
  .title { font-size: 40px; line-height: 1.1; font-weight: 800; margin: 12px 0 6px; max-width: 16em; }
  .detail { font-size: 18px; color: #4b5563; margin-bottom: 8px; }
  .qrwrap { margin: 30px 0 10px; padding: 16px; border: 2px solid ${brand}; border-radius: 18px; background: #fff; }
  .qrwrap svg { width: 200px; height: 200px; display: block; }
  .scan { font-size: 18px; font-weight: 700; margin-top: 6px; }
  .url { font-size: 14px; color: #6b7280; word-break: break-all; max-width: 30em; margin-top: 6px; }
  .foot { margin-top: auto; padding-top: 24px; font-size: 12px; color: #9ca3af; }
  .toolbar { position: fixed; top: 12px; right: 12px; }
  .toolbar button { font: inherit; font-size: 14px; font-weight: 600; color: #fff; background: ${brand}; border: 0; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
  @media print { .toolbar { display: none; } }
</style></head>
<body>
  <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button></div>
  <div class="sheet">
    <div class="bar"></div>
    <div class="logo">${logo}</div>
    <div class="kicker">We're hiring</div>
    <div class="title">${esc(jobTitle)}</div>
    <div class="detail">${esc([location, employmentType, salary].filter(Boolean).join("  ·  ") || companyName)}</div>
    <div class="qrwrap">${svg}</div>
    <div class="scan">Scan to apply</div>
    <div class="url">${esc(jobUrl)}</div>
    <div class="foot">${esc(companyName)} · Recruiting with Join Care Now</div>
  </div>
  <script>window.addEventListener("load", function(){ setTimeout(function(){ window.print(); }, 350); });<\/script>
</body></html>`;

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      try { win.close(); } catch { /* ignore */ }
      setPosterErr("Could not build the poster. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const btn =
    "inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 shrink-0";

  return (
    <div className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm p-5">
      <h2 className="text-sm font-semibold text-gray-900">Promote this job</h2>
      <p className="mt-0.5 text-xs text-gray-500">Share your role and bring in more applicants.</p>

      {/* Job link — for Indeed & other job boards */}
      <div className="mt-4">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700">
          <Link2 className="h-3.5 w-3.5" aria-hidden /> Job link — paste into Indeed or any job board
        </label>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            readOnly
            value={jobUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
          />
          <button type="button" onClick={() => copy("link", jobUrl)} className={btn}>
            {copied === "link" ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === "link" ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {/* Pre-written social posts */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <PostBlock
            icon={<Linkedin className="h-3.5 w-3.5" aria-hidden />}
            label="LinkedIn post"
            text={linkedinPost}
            copied={copied === "li"}
            onCopy={() => copy("li", linkedinPost)}
          />
          <button
            type="button"
            onClick={shareLinkedIn}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#0A66C2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#084e96]"
          >
            <Linkedin className="h-3.5 w-3.5" aria-hidden /> Share to LinkedIn
          </button>
          {copied === "li-share" && (
            <p className="mt-1 text-xs text-gray-500">Caption copied — paste it into the LinkedIn post box.</p>
          )}
        </div>
        <div>
          <PostBlock
            icon={<Facebook className="h-3.5 w-3.5" aria-hidden />}
            label="Facebook post"
            text={facebookPost}
            copied={copied === "fb"}
            onCopy={() => copy("fb", facebookPost)}
          />
          <button
            type="button"
            onClick={shareFacebook}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0f66d0]"
          >
            <Facebook className="h-3.5 w-3.5" aria-hidden /> Share to Facebook
          </button>
          {copied === "fb-share" && (
            <p className="mt-1 text-xs text-gray-500">Caption copied — paste it into the Facebook post box.</p>
          )}
        </div>
      </div>

      {/* Share to staff */}
      <div className="mt-4">
        <PostBlock
          icon={<Users className="h-3.5 w-3.5" aria-hidden />}
          label="Share with your staff (referrals)"
          text={staffMessage}
          copied={copied === "staff"}
          onCopy={() => copy("staff", staffMessage)}
          rows={3}
        />
        <button
          type="button"
          onClick={shareWhatsApp}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1da851]"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> Share on WhatsApp
        </button>
      </div>

      {/* QR poster */}
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-200/70 pt-4">
        <button
          type="button"
          onClick={openPoster}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <QrCode className="h-4 w-4" aria-hidden />
          {busy ? "Building…" : "Print job poster (QR)"}
        </button>
        <span className="text-xs text-gray-500">A branded A4 poster with a scan-to-apply QR code.</span>
      </div>
      {posterErr && <p className="mt-2 text-xs text-red-600">{posterErr}</p>}
    </div>
  );
}

function PostBlock({
  icon,
  label,
  text,
  copied,
  onCopy,
  rows = 5,
}: {
  icon: React.ReactNode;
  label: string;
  text: string;
  copied: boolean;
  onCopy: () => void;
  rows?: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-medium text-gray-700">{icon} {label}</span>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <textarea
        readOnly
        rows={rows}
        value={text}
        onFocus={(e) => e.currentTarget.select()}
        className="mt-1.5 w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
      />
    </div>
  );
}
