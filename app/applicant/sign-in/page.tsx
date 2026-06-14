"use client";

import Link from "next/link";
import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { applicantSignIn } from "@/modules/applicants/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

function SignInForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState(applicantSignIn, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="next" value={next} />
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

function SignUpLinkInner() {
  const next = useSearchParams().get("next");
  const href = next
    ? `/applicant/sign-up?next=${encodeURIComponent(next)}`
    : "/applicant/sign-up";
  return (
    <p className="mt-4 text-center text-sm text-gray-600">
      New here?{" "}
      <Link href={href} className="text-brand-600 hover:underline">
        Create an account
      </Link>
    </p>
  );
}

export default function ApplicantSignInPage() {
  return (
    <AuthCard
      title="Sign in to apply"
      subtitle="Use your existing applicant account to apply for this role."
    >
      <Suspense>
        <SignInForm />
      </Suspense>
      <Suspense>
        <SignUpLinkInner />
      </Suspense>
    </AuthCard>
  );
}
