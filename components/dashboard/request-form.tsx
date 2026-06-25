"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { submitRequest, type RequestState } from "@/modules/requests/actions";

export function RequestForm() {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const [state, action] = useActionState<RequestState, FormData>(submitRequest, undefined);

  useEffect(() => {
    if (state?.ok) {
      ref.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={ref} action={action} className="rounded-2xl border border-white/40 bg-white/70 backdrop-blur-md p-5 shadow-sm backdrop-blur">
      <label className="text-sm font-medium text-gray-900">Request a feature</label>
      <p className="mt-0.5 text-xs text-gray-500">Tell us what you&apos;d like built — we&apos;ll come back with a quote.</p>
      <input
        name="title"
        placeholder="Short title (e.g. Rota integration)"
        className="mt-3 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <textarea
        name="body"
        rows={4}
        placeholder="Describe what you'd like it to do…"
        className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
      <div className="mt-3 flex items-center gap-3">
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Submit request
        </button>
        {state?.ok && <span className="text-sm text-green-700">Submitted!</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
