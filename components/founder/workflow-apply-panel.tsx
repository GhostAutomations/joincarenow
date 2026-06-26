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
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="workflowId" value={wf.id} />
          <div>
            <label className="block text-xs font-medium text-gray-600">Apply to role</label>
            <select
              name="roleId"
              defaultValue=""
              className="mt-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="">Everyone (no specific role)</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <button className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
            Apply workflow
          </button>
          {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
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
