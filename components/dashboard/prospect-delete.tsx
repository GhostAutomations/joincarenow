"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteProspect } from "@/modules/prospects/actions";

export function ProspectDelete({ id }: { id: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-300 hover:text-red-200"
      >
        <Trash2 className="h-3.5 w-3.5" /> Delete prospect
      </button>
    );
  }

  return (
    <form action={deleteProspect} className="inline-flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-xs text-white/80">Delete this prospect and all its data?</span>
      <button className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700">Yes, delete</button>
      <button type="button" onClick={() => setConfirming(false)} className="rounded-lg border border-white/40 px-2.5 py-1 text-xs text-white hover:bg-white/10">Cancel</button>
    </form>
  );
}
