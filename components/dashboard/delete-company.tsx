"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCompany, type SettingsState } from "@/modules/companies/actions";

export function DeleteCompany({ companyId, companyName }: { companyId: string; companyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, action] = useActionState<SettingsState, FormData>(deleteCompany, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
    );
  }

  return (
    <form action={action} className="rounded-lg border border-red-200 bg-red-50 p-3">
      <input type="hidden" name="companyId" value={companyId} />
      <p className="text-xs text-red-900">
        This permanently deletes <strong>{companyName}</strong> and all its data (jobs, applicants,
        employees, documents). Type the company name to confirm.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          name="confirmName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={companyName}
          className="block w-full rounded-md border border-red-300 px-2.5 py-1.5 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button
          disabled={name.trim() !== companyName}
          className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Delete
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setName(""); }}
          className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
      {state?.error && <p className="mt-2 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
