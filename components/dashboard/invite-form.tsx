"use client";

import { useActionState } from "react";
import { createInvitation, type InviteState } from "@/modules/invitations/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";
import { InviteLink } from "@/components/dashboard/invite-link";

type Role = { value: "admin" | "manager" | "recruiter"; label: string };

export function InviteForm({
  companyId,
  roles,
}: {
  companyId: string;
  roles: Role[];
}) {
  const [state, action] = useActionState<InviteState, FormData>(
    createInvitation,
    undefined
  );

  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <FormError error={state?.error} />
        <input type="hidden" name="companyId" value={companyId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
          />

          {roles.length === 1 ? (
            <input type="hidden" name="role" value={roles[0].value} />
          ) : (
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700"
              >
                Role
              </label>
              <select
                id="role"
                name="role"
                defaultValue={roles[0].value}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                {roles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="sm:w-48">
          <SubmitButton>Send invitation</SubmitButton>
        </div>
      </form>

      {state?.inviteLink && (
        <InviteLink link={state.inviteLink} email={state.invitedEmail!} />
      )}
    </div>
  );
}
