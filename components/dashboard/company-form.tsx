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
        <Field label="Company name" name="name" placeholder="e.g. Acme Care Ltd" />

        {/* Administrator */}
        <div className="rounded-xl border border-white/50 bg-white/70 p-4 backdrop-blur">
          <p className="text-sm font-medium text-gray-900">Administrator</p>
          <p className="mt-0.5 text-xs text-gray-500">
            The person who runs this company&apos;s account. They&apos;ll be invited as admin.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" name="adminName" placeholder="e.g. Jane Smith" />
            <Field label="Job role" name="adminRole" required={false} placeholder="e.g. Registered Manager" />
            <Field label="Email" name="adminEmail" type="email" autoComplete="off" placeholder="admin@example.com" />
            <Field label="Phone" name="adminPhone" type="tel" required={false} placeholder="e.g. 07700 900000" />
          </div>
        </div>

        {/* Plan & billing */}
        <div className="rounded-xl border border-white/50 bg-white/70 p-4 backdrop-blur">
          <p className="text-sm font-medium text-gray-900">Plan &amp; billing</p>
          <p className="mt-0.5 text-xs text-gray-500">
            Choose what they were sold. They&apos;ll set up the subscription themselves from the
            welcome email; this sets what they&apos;re charged.
          </p>
          <label className="mt-3 block text-sm font-medium text-gray-700">
            Plan
            <select
              name="plan"
              defaultValue=""
              required
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              <option value="" disabled>Select plan…</option>
              <option value="monthly">Monthly — £55/mo (+£150 set-up)</option>
              <option value="commit">12-month commit — £55/mo, no set-up</option>
              <option value="annual">Annual — £550/yr (2 months free), no set-up</option>
              <option value="diamond">Diamond — comped subscription &amp; set-up (pay usage only)</option>
            </select>
          </label>
          <p className="mt-3 text-xs font-medium text-gray-600">Offer / concession (optional)</p>
          <div className="mt-1 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block text-xs font-medium text-gray-600">
              Free months
              <input type="number" name="offerFreeMonths" min={0} max={12} placeholder="0" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Custom £/month
              <input type="number" name="offerCustomPrice" min={0} step="0.01" placeholder="e.g. 45" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs font-medium text-gray-600">
              Extra SMS/month
              <input type="number" name="offerExtraSms" min={0} placeholder="e.g. 100" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
          </div>
        </div>

        {/* Branding */}
        <div className="rounded-xl border border-white/50 bg-white/70 p-4 backdrop-blur">
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
