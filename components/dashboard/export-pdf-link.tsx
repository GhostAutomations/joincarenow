import { FileText } from "lucide-react";

/** Link to a server-generated report PDF. Styled to match ExportCsvButton
 *  (white-on-glass), for the gradient header areas of the report pages. */
export function ExportPdfLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1.5 rounded-lg border border-white/40 bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur hover:bg-white/30"
    >
      <FileText className="h-4 w-4" /> Export PDF
    </a>
  );
}
