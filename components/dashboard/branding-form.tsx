"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { setBranding, type SettingsState } from "@/modules/companies/actions";
import { LogoCropper } from "@/components/dashboard/logo-cropper";

type Brand = { primary?: string; secondary?: string; accent?: string; logo_url?: string | null };

export function BrandingForm({ companyId, brand, submitLabel = "Save branding" }: { companyId: string; brand: Brand; submitLabel?: string }) {
  const router = useRouter();
  const [state, action] = useActionState<SettingsState, FormData>(setBranding, undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.ok) { router.refresh(); window.dispatchEvent(new Event("jcn-section-saved")); }
  }, [state, router]);

  // The cropper hands back a cropped File; stash it on the hidden file input so
  // it submits as `logo` with the form (the existing setBranding handling).
  function onCropped(file: File | null) {
    if (!fileRef.current) return;
    const dt = new DataTransfer();
    if (file) dt.items.add(file);
    fileRef.current.files = dt.files;
  }

  const swatch = (name: string, label: string, value?: string) => (
    <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
      <input type="color" name={name} defaultValue={value || "#4f46e5"} className="h-9 w-12 cursor-pointer rounded border border-white/40 bg-white p-0.5" />
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
        <div className="mt-2">
          <LogoCropper currentLogoUrl={brand.logo_url} onCropped={onCropped} />
        </div>
        {/* Cropped logo is placed here for upload (name="logo"). */}
        <input ref={fileRef} type="file" name="logo" accept="image/*" className="hidden" />
      </div>

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
