"use client";

import { useActionState } from "react";
import { selfServeSignUp, type SignupState } from "@/modules/signup/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

export function SelfServeSignupForm() {
  const [state, action] = useActionState<SignupState, FormData>(selfServeSignUp, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />

      <Field label="Company name" name="companyName" autoComplete="organization" />
      <Field
        label="Company or CQC / CIW registration number"
        name="providerRef"
        autoComplete="off"
        placeholder="Helps us confirm you're a care provider (optional)"
      />

      <div className="border-t border-gray-100 pt-4">
        <Field label="Your full name" name="fullName" autoComplete="name" />
        <div className="mt-4">
          <Field label="Work email" name="email" type="email" autoComplete="email" />
        </div>
        <div className="mt-4">
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-600">
        <input type="checkbox" name="agree" className="mt-0.5" />
        <span>
          I agree to the{" "}
          <a href="/terms" className="font-medium text-amber-700 hover:underline">terms of service</a>{" "}
          and{" "}
          <a href="/privacy" className="font-medium text-amber-700 hover:underline">privacy policy</a>.
        </span>
      </label>

      <SubmitButton>Start free trial</SubmitButton>
      <p className="text-center text-xs text-gray-400">
        Free trial. We&apos;ll set your first careers page and jobs up with you.
      </p>
    </form>
  );
}
