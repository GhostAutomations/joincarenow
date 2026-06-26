"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { FileUp } from "lucide-react";
import { importFormFromPdf, type ImportState } from "@/modules/forms/actions";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
    >
      <FileUp className="h-4 w-4" />
      {pending ? "Reading PDF…" : "Import from PDF"}
    </button>
  );
}

export function PdfImport({ formId }: { formId: string }) {
  const [state, action] = useActionState<ImportState, FormData>(
    importFormFromPdf,
    undefined
  );
  useEffect(() => {
    if (state?.added) window.location.assign(`${window.location.pathname}?view=builder`);
  }, [state]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="formId" value={formId} />
      <p className="text-sm text-gray-500">
        Upload an existing application form (PDF) and we&apos;ll read it and add
        the questions below for you to review and edit.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="pdf"
          accept="application/pdf,.pdf"
          required
          className="text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
        />
        <SubmitBtn />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.added ? (
        <p className="text-sm text-green-700">
          Added {state.added} field{state.added === 1 ? "" : "s"} — review and
          edit them below, then they&apos;re ready to use.
        </p>
      ) : null}
    </form>
  );
}
