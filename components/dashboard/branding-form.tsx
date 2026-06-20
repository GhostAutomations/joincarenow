"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { setBranding, type SettingsState } from "@/modules/companies/actions";

type Brand = { primary?: string; secondary?: string; accent?: string; logo_url?: string | null };

export function BrandingForm({ companyId, brand }: { companyId: string; brand: Brand }) {
  const router = useRouter();
  const [state, action] = useActionState<SettingsState, FormData>(setBranding, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const swatch = (name: string, label: string, value?: string) => (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
      <input type="color" name={name} defaultValue={value || "#4f46e5"} className="h-9 w-12 cursor-pointer rounded border border-gray-300 bg-white p-0.5" />
      {label}
    </label>
  );

  return (
    <form action={action} className="mt-4 space-y-4">
      <input type="hidden" name="companyId" value={companyId} />

      <div>
        <p className="text-xs font-medium text-gray-600">Brand colours</p>
        <div className="mt-2 flex flex-wrap gap-4">
          {swatch("brandPrimary", "Primary", brand.primary)}
          {swatch("brandSecondary", "Secondary", brand.secondary)}
          {swatch("brandAccent", "Accent", brand.accent)}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-600">Logo</p>
        {brand.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logo_url} alt="Current logo" className="mt-2 h-12 w-auto max-w-[180px] rounded bg-white object-contain p-1 ring-1 ring-gray-200" />
        )}
        <input
          type="file"
          name="logo"
          accept="image/*"
          className="mt-2 block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700"
        />
        <p className="mt-1 text-xs text-gray-400">PNG or SVG, under 2MB. Leave empty to keep the current logo.</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Save branding
        </button>
        {state?.ok && <span className="text-sm text-green-700">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
