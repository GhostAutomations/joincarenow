"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompany, type CompanyState } from "@/modules/companies/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

export function CompanyForm() {
  const [state, action] = useActionState<CompanyState, FormData>(
    createCompany,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <FormError error={state?.error} />
        <Field
          label="Company name"
          name="name"
          placeholder="e.g. Acme Care Ltd"
        />
      </div>
      <div className="sm:w-48">
        <SubmitButton>Create company</SubmitButton>
      </div>
    </form>
  );
}
