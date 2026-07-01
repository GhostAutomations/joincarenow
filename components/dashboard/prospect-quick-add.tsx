"use client";

import { useActionState, useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { createProspect, type ProspectState } from "@/modules/prospects/actions";

const input =
  "mt-1 block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function ProspectQuickAdd() {
  const [state, action] = useActionState<ProspectState, FormData>(createProspect, undefined);
  const [more, setMore] = useState(false);

  return (
    <form action={action} className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-4 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[180px] flex-1 text-xs font-medium text-gray-600">
          Company name
          <input name="name" placeholder="e.g. Sunrise Home Care" className={input} />
        </label>
        <label className="min-w-[180px] flex-1 text-xs font-medium text-gray-600">
          Contact email (optional)
          <input name="email" type="email" placeholder="manager@example.com" className={input} />
        </label>
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMore((m) => !m)}
        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${more ? "rotate-180" : ""}`} /> More details
      </button>

      {more && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-medium text-gray-600">
            Contact name
            <input name="contact_name" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Contact role
            <input name="role" placeholder="Registered manager" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Contact phone
            <input name="contact_phone" placeholder="07…" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Care setting
            <select name="setting_type" className={input} defaultValue="">
              <option value="">—</option>
              <option value="domiciliary">Domiciliary</option>
              <option value="residential">Residential</option>
              <option value="supported_living">Supported living</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="text-xs font-medium text-gray-600">
            Region
            <input name="region" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Website
            <input name="website" placeholder="https://" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Source
            <input name="source" placeholder="e.g. LinkedIn, referral" className={input} />
          </label>
          <label className="text-xs font-medium text-gray-600">
            Est. value (£/month)
            <input name="value_monthly" type="number" min="0" step="1" placeholder="e.g. 99" className={input} />
          </label>
        </div>
      )}

      {state?.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
