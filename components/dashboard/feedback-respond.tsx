"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { respondFeedback, type FeedbackState } from "@/modules/feedback/actions";

export function FeedbackRespond({ id, existing }: { id: string; existing: string | null }) {
  const router = useRouter();
  const [state, action] = useActionState<FeedbackState, FormData>(respondFeedback, undefined);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="mt-3">
      <input type="hidden" name="id" value={id} />
      <textarea
        name="response"
        rows={2}
        defaultValue={existing ?? ""}
        placeholder="Write a reply…"
        className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-2 flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
          {existing ? "Update reply" : "Send reply"}
        </button>
        {state?.ok && <span className="text-xs text-green-700">Saved.</span>}
        {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
