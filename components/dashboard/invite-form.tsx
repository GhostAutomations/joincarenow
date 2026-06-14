"use client";

import { useActionState, useEffect, useState } from "react";
import { createInvitation, type InviteState } from "@/modules/invitations/actions";
import { Field, SubmitButton, FormError } from "@/components/ui/form";

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

function InviteLink({ link, email }: { link: string; email: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4">
      <p className="text-sm font-medium text-green-800">
        Invitation created for {email}
      </p>
      <p className="mt-1 text-xs text-green-700">
        Send them this link to set up their account (it expires in 14 days):
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="block w-full rounded-md border border-green-300 bg-white px-2 py-1.5 text-xs text-gray-700"
        />
        <button
          type="button"
          onClick={copy}
          className="shrink-0 rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-2 text-xs text-green-700">
        Once email sending is connected, this link will be emailed automatically.
      </p>
    </div>
  );
}
