"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCompany, type CompanyState } from "@/modules/companies/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";
import { InviteLink } from "@/components/dashboard/invite-link";

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
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Company name"
            name="name"
            placeholder="e.g. Acme Care Ltd"
          />
          <Field
            label="Admin email"
            name="adminEmail"
            type="email"
            autoComplete="off"
            placeholder="admin@example.com"
          />
        </div>
        <p className="text-xs text-gray-500">
          Creating the company also invites this person as its administrator.
          Once email sending is connected, the invitation is emailed
          automatically; for now, copy the link below and send it to them.
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
