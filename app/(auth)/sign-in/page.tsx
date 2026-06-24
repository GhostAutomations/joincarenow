"use client";

import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

function SignInForm() {
  const searchParams = useSearchParams();
  const [state, action] = useActionState(signIn, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />
      <input
        type="hidden"
        name="next"
        value={searchParams.get("next") ?? ""}
      />
      <Field label="Email address" name="email" type="email" autoComplete="email" defaultValue={searchParams.get("email") ?? undefined} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
      />
      <SubmitButton>Sign in</SubmitButton>
    </form>
  );
}

export default function SignInPage() {
  return (
    <AuthCard
      title="Sign in"
      subtitle="Staff access is by invitation. If you've been invited, use the link in your email to set up your account."
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
