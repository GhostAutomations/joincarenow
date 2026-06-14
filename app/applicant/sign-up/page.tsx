"use client";

import Link from "next/link";
import { useActionState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { applicantSignUp } from "@/modules/applicants/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

function SignUpForm() {
  const next = useSearchParams().get("next") ?? "";
  const [state, action] = useActionState(applicantSignUp, undefined);

  return (
    <form action={action} className="space-y-4">
      <FormError error={state?.error} />
      <input type="hidden" name="next" value={next} />
      <Field label="Full name" name="fullName" autoComplete="name" />
      <Field label="Email address" name="email" type="email" autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />
      <SubmitButton>Create account &amp; continue</SubmitButton>
    </form>
  );
}

export default function ApplicantSignUpPage() {
  return (
    <AuthCard
      title="Create your applicant account"
      subtitle="One account lets you apply to any employer using Join Care Now."
    >
      <Suspense>
        <SignUpForm />
      </Suspense>
      <SignInLink />
    </AuthCard>
  );
}

function SignInLink() {
  return (
    <Suspense>
      <SignInLinkInner />
    </Suspense>
  );
}

function SignInLinkInner() {
  const next = useSearchParams().get("next");
  const href = next
    ? `/applicant/sign-in?next=${encodeURIComponent(next)}`
    : "/applicant/sign-in";
  return (
    <p className="mt-4 text-center text-sm text-gray-600">
      Already applied before?{" "}
      <Link href={href} className="text-brand-600 hover:underline">
        Sign in
      </Link>
    </p>
  );
}
