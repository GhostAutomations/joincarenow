"use client";

import { useActionState, useEffect, useRef } from "react";
import { Trash2, Plus } from "lucide-react";
import { createRole, deleteRole, type RoleState } from "@/modules/roles/actions";

export function RolesManager({
  roles,
  companyId,
}: {
  roles: { id: string; name: string }[];
  companyId: string;
}) {
  const [state, action] = useActionState<RoleState, FormData>(createRole, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <div>
      {roles.length > 0 && (
        <ul className="mb-4 divide-y divide-gray-100">
          {roles.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm font-medium text-gray-900">{r.name}</span>
              <form action={deleteRole}>
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="companyId" value={companyId} />
                <button
                  className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Remove role"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form ref={ref} action={action} className="flex items-start gap-2">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="flex-1">
          {state?.error && <p className="mb-1 text-xs text-red-600">{state.error}</p>}
          <input
            name="name"
            placeholder="e.g. Walker, Driver, Care Assistant"
            className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>
    </div>
  );
}
