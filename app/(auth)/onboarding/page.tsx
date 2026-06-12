"use client";

import { useActionState } from "react";
import { createCompany } from "@/modules/companies/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

export default function OnboardingPage() {
  const [state, action] = useActionState(createCompany, undefined);

  return (
    <AuthCard
      title="Set up your company"
      subtitle="This creates your company workspace. You'll be its first admin."
    >
      <form action={action} className="space-y-4">
        <FormError error={state?.error} />
        <Field
          label="Company name"
          name="name"
          placeholder="e.g. Acme Care Ltd"
        />
        <SubmitButton>Create company</SubmitButton>
      </form>
    </AuthCard>
  );
}
