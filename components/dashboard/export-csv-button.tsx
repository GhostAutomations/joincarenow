"use client";

import { Download } from "lucide-react";

type Row = Record<string, string | number>;

/** Client-side CSV export of the billing table (no server round-trip). */
export function ExportCsvButton({ rows, filename = "billing.csv" }: { rows: Row[]; filename?: string }) {
  function download() {
    if (rows.length === 0) return;
    const headers = Object.keys(rows[0]);
    const esc = (v: string | number) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
    >
      <Download className="h-4 w-4" /> Export CSV
    </button>
  );
}
