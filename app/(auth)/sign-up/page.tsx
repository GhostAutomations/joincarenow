"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp } from "@/modules/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

export default function SignUpPage() {
  const [state, action] = useActionState(signUp, undefined);

  return (
    <AuthCard
      title="Create your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href="/sign-in" className="text-brand-600 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form action={action} className="space-y-4">
        <FormError error={state?.error} />
        <Field label="Full name" name="fullName" autoComplete="name" />
        <Field label="Email address" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
        <SubmitButton>Create account</SubmitButton>
      </form>
    </AuthCard>
  );
}
