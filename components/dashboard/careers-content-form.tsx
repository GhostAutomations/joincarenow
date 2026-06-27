"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { setCareersContent, type SettingsState } from "@/modules/companies/actions";

const cls =
  "block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function CareersContentForm({
  companyId,
  intro,
  benefits,
  submitLabel = "Save careers content",
}: {
  companyId: string;
  intro: string;
  benefits: string[];
  submitLabel?: string;
}) {
  const [state, action] = useActionState<SettingsState, FormData>(
    setCareersContent,
    undefined
  );
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) { router.refresh(); window.dispatchEvent(new Event("jcn-section-saved")); }
  }, [state, router]);

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />

      <label className="block text-xs font-medium text-gray-600">
        About / why work here
        <textarea
          name="intro"
          rows={4}
          defaultValue={intro}
          placeholder="A short paragraph that sells your company to candidates — who you are, your values, what makes you a great place to work."
          className={`mt-1 ${cls}`}
        />
      </label>

      <label className="block text-xs font-medium text-gray-600">
        Benefits (one per line)
        <textarea
          name="benefits"
          rows={5}
          defaultValue={benefits.join("\n")}
          placeholder={"Competitive pay\nFlexible hours\nFully funded training\nPension scheme"}
          className={`mt-1 ${cls}`}
        />
      </label>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          {submitLabel}
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
