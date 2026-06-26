"use client";

import { useActionState } from "react";
import { Globe, EyeOff } from "lucide-react";
import { setStorePublished, type DetailsState } from "@/modules/forms/actions";

export function StorePublishBar({ formId, published }: { formId: string; published: boolean }) {
  const [state, action] = useActionState<DetailsState, FormData>(setStorePublished, undefined);

  return (
    <form action={action} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/55 p-4 shadow-sm backdrop-blur-md">
      <input type="hidden" name="id" value={formId} />
      <input type="hidden" name="publish" value={(!published).toString()} />
      <div className="flex items-center gap-2 text-sm">
        {published ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 font-medium text-green-800">
            <Globe className="h-3.5 w-3.5" /> Live in the Form Store
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-800">
            <EyeOff className="h-3.5 w-3.5" /> Draft — not visible to companies
          </span>
        )}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
      <button
        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white ${
          published ? "bg-gray-600 hover:bg-gray-700" : "bg-brand-600 hover:bg-brand-700"
        }`}
      >
        {published ? <EyeOff className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
        {published ? "Unpublish" : "Publish to Form Store"}
      </button>
    </form>
  );
}
