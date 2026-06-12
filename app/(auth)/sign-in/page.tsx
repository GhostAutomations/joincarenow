"use client";

import Link from "next/link";
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
      <Field label="Email address" name="email" type="email" autoComplete="email" />
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
      subtitle={
        <>
          New to Join Care Now?{" "}
          <Link href="/sign-up" className="text-brand-600 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
