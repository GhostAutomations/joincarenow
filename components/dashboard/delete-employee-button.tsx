"use client";

import { Trash2 } from "lucide-react";
import { deleteEmployee } from "@/modules/employees/actions";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteEmployee}
      onSubmit={(e) => {
        if (!confirm(`Delete the employee record for ${name}? Their recruitment history and signed documents are kept.`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white/80 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
        <Trash2 className="h-4 w-4" /> Delete employee
      </button>
    </form>
  );
}
