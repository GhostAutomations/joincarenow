"use client";

import { useRef } from "react";
import { updateStage } from "@/modules/prospects/actions";
import { STAGES, STAGE_LABEL } from "@/lib/prospects";

export function ProspectStageSelect({ id, stage }: { id: string; stage: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form action={updateStage} ref={ref}>
      <input type="hidden" name="id" value={id} />
      <select
        name="stage"
        defaultValue={stage}
        onChange={() => ref.current?.requestSubmit()}
        className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium focus:border-brand-500 focus:outline-none"
      >
        {STAGES.map((s) => (
          <option key={s} value={s}>{STAGE_LABEL[s]}</option>
        ))}
      </select>
    </form>
  );
}
