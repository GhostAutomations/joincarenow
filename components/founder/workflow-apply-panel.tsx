"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { applyStoreWorkflow, type ApplyState } from "@/modules/workflows/actions";

export type ApplyWorkflow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  stepCount: number;
};
export type RoleOption = { id: string; name: string };

function WorkflowRow({
  companyId,
  wf,
  roles,
  applied,
}: {
  companyId: string;
  wf: ApplyWorkflow;
  roles: RoleOption[];
  applied: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ApplyState, FormData>(applyStoreWorkflow, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const done = applied || state?.ok;

  return (
    <form action={action} className="rounded-xl border border-gray-200 bg-white/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{wf.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {wf.category ? `${wf.category} · ` : ""}{wf.stepCount} step{wf.stepCount === 1 ? "" : "s"}
            {wf.description ? ` · ${wf.description}` : ""}
          </p>
        </div>
        {done && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Applied
          </span>
        )}
      </div>

      {!done && (
        <div className="mt-3">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="workflowId" value={wf.id} />
          <label className="block text-xs font-medium text-gray-600">Apply to role(s)</label>
          <p className="text-[11px] text-gray-400">Tick one or more. Leave all unticked to apply to everyone.</p>
          <div className="mt-1.5 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2">
            {roles.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded px-1 py-1 text-sm text-gray-700 hover:bg-white/60">
                <input type="checkbox" name="roleId" value={r.id} className="h-4 w-4 rounded border-white/40 text-brand-600 focus:ring-brand-500" />
                {r.name}
              </label>
            ))}
            {roles.length === 0 && <p className="px-1 text-xs text-gray-400">No roles yet — add roles first.</p>}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
              Apply workflow
            </button>
            {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
          </div>
        </div>
      )}
    </form>
  );
}

export function WorkflowApplyPanel({
  companyId,
  workflows,
  roles,
  appliedNames,
}: {
  companyId: string;
  workflows: ApplyWorkflow[];
  roles: RoleOption[];
  appliedNames: string[];
}) {
  if (workflows.length === 0) {
    return (
      <p className="mt-4 text-sm text-gray-500">
        No published workflows yet. Build and publish workflows in the Founder{" "}
        <span className="font-medium">Workflows</span> app, then they&apos;ll appear here to apply.
      </p>
    );
  }
  const appliedSet = new Set(appliedNames);
  return (
    <div className="mt-4 space-y-3">
      {workflows.map((wf) => (
        <WorkflowRow
          key={wf.id}
          companyId={companyId}
          wf={wf}
          roles={roles}
          applied={appliedSet.has(wf.name)}
        />
      ))}
    </div>
  );
}
