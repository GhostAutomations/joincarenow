"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { decideRequest, type RequestState } from "@/modules/requests/actions";

export function RequestDecide({ id }: { id: string }) {
  const router = useRouter();
  const [state, action] = useActionState<RequestState, FormData>(decideRequest, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3 flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <button
        name="decision"
        value="accepted"
        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
      >
        Accept quote
      </button>
      <button
        name="decision"
        value="declined"
        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
      >
        Decline
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
