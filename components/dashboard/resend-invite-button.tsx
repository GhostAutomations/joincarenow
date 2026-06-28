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
        className="rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Sending…" : state?.ok ? "Sent ✓" : "Resend"}
      </button>
      {state?.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
