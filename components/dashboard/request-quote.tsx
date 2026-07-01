"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { quoteRequest, type RequestState } from "@/modules/requests/actions";

export function RequestQuote({
  id,
  amount,
  note,
}: {
  id: string;
  amount: string | null;
  note: string | null;
}) {
  const router = useRouter();
  const [state, action] = useActionState<RequestState, FormData>(quoteRequest, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3 space-y-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="quoteAmount"
        defaultValue={amount ?? ""}
        placeholder="Price (e.g. £750, or £500 + £20/mo)"
        className="block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <textarea
        name="quoteNote"
        rows={2}
        defaultValue={note ?? ""}
        placeholder="Optional note (scope, timeline…)"
        className="block w-full rounded-lg border border-white/40 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          {amount ? "Update quote" : "Send quote"}
        </button>
        {state?.ok && <span className="text-xs text-green-700">Saved.</span>}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
