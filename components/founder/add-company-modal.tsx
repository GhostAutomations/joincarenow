"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { CompanyForm } from "@/components/dashboard/company-form";

/** Founder companies screen: "Add a company" button that opens the create
 *  form in a popup, matching the established modal pattern. */
export function AddCompanyModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a company
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Add a company">
          <button aria-label="Close" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">Add a company</h3>
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-6">
              <CompanyForm />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
