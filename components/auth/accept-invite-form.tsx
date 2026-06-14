"use client";

import { useActionState } from "react";
import { acceptAsNewUser } from "@/modules/invitations/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

export function NewUserAcceptForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, action] = useActionState(acceptAsNewUser, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="token" value={token} />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email address
        </label>
        <input
          value={email}
          disabled
          className="mt-1 block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500"
        />
      </div>

      <Field label="Full name" name="fullName" autoComplete="name" />
      <Field
        label="Create a password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <SubmitButton>Accept &amp; create account</SubmitButton>
    </form>
  );
}
