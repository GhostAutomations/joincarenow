"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompany, type CompanyState } from "@/modules/companies/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";
import { InviteLink } from "@/components/dashboard/invite-link";

const COLOURS = [
  { name: "brandPrimary", label: "Primary", hint: "Buttons, links, highlights", def: "#0d9488" },
  { name: "brandSecondary", label: "Secondary", hint: "Supporting / mid gradient", def: "#0e7490" },
  { name: "brandAccent", label: "Accent", hint: "Deepest gradient tone", def: "#3730a3" },
];

export function CompanyForm() {
  const [state, action] = useActionState<CompanyState, FormData>(
    createCompany,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.inviteLink) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className="space-y-4">
        <FormError error={state?.error} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Company name"
            name="name"
            placeholder="e.g. Acme Care Ltd"
          />
          <Field
            label="Admin email"
            name="adminEmail"
            type="email"
            autoComplete="off"
            placeholder="admin@example.com"
          />
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium text-gray-900">Branding</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose up to three brand colours and upload a logo. These theme the
            whole platform for this company — leave them as the defaults to keep
            the standard Join Care Now look.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {COLOURS.map((c) => (
              <label key={c.name} className="block text-xs font-medium text-gray-600">
                {c.label}
                <span className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    name={c.name}
                    defaultValue={c.def}
                    className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-gray-300 bg-white p-0.5"
                  />
                  <span className="text-[11px] font-normal text-gray-400">{c.hint}</span>
                </span>
              </label>
            ))}
          </div>

          <label className="mt-3 block text-xs font-medium text-gray-600">
            Company logo (PNG or SVG, under 2MB)
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="mt-1 block w-full text-sm text-gray-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
            />
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Creating the company sends this person a welcome email automatically.
          They get their login link in the &ldquo;account ready&rdquo; email you fire from
          the company&apos;s setup page once you&apos;ve finished setting them up. The link
          below is a manual fallback if you need it.
        </p>
        <div className="sm:w-56">
          <SubmitButton>Create company &amp; invite admin</SubmitButton>
        </div>
      </form>

      {state?.inviteLink && (
        <InviteLink link={state.inviteLink} email={state.invitedEmail!} />
      )}
    </div>
  );
}
