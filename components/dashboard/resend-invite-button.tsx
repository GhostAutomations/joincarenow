"use client";

import { useActionState } from "react";
import { resendInvitation, type ResendState } from "@/modules/invitations/actions";

/** Re-sends the invite email for a pending invitation, with inline feedback. */
export function ResendButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<ResendState, FormData>(
    resendInvitation,
    undefined
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-brand-300 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending…" : state?.ok ? "Sent ✓" : "Resend"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
