"use client";

import { useActionState } from "react";
import { setShowSidebar, type SettingsState } from "@/modules/companies/actions";

export function SidebarToggle({
  companyId,
  show,
}: {
  companyId: string;
  show: boolean;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(setShowSidebar, undefined);

  return (
    <form action={action} className="mt-4 flex items-center gap-3">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          name="showSidebar"
          defaultChecked={show}
          className="mt-0.5 h-4 w-4 rounded border-white/40 text-brand-600"
        />
        <span>
          <span className="font-medium text-gray-900">Show the left sidebar</span>
          <br />
          Off by default — navigation lives on the home screen (iPad‑style). Turn on for a
          classic sidebar menu on every page.
        </span>
      </label>
      <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        Save
      </button>
      {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
    </form>
  );
}
