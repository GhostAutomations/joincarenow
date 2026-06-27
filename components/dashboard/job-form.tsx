"use client";

import { useActionState, useState } from "react";
import { SubmitButton, FormError } from "@/components/ui/form";
import type { JobState } from "@/modules/jobs/actions";

type Action = (prev: JobState, formData: FormData) => Promise<JobState>;

export type JobDefaults = {
  id?: string;
  title?: string;
  description?: string;
  employment_type?: string;
  branch_id?: string;
  role_id?: string;
  workflow_role_id?: string;
  salary?: string;
  vacancies?: number;
  closing_date?: string;
  application_form_id?: string;
  contract_template_id?: string;
  policy_ids?: string[];
  owner_id?: string;
};

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

const EMPLOYMENT_TYPES = [
  "Full time",
  "Part time",
  "Bank / Casual",
  "Fixed term",
  "Apprenticeship",
];

export function JobForm({
  action,
  defaults,
  submitLabel,
  forms = [],
  branches = [],
  roles = [],
  owners = [],
}: {
  action: Action;
  defaults?: JobDefaults;
  submitLabel: string;
  forms?: { id: string; name: string }[];
  branches?: { id: string; name: string; kind?: string }[];
  roles?: { id: string; name: string; team?: string }[];
  owners?: { user_id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<JobState, FormData>(action, undefined);

  // Save stays disabled until something actually changes.
  const [dirty, setDirty] = useState(false);

  // Recruiting target: a branch (location) or the Office Team (a branch with
  // kind='office'). The chosen target's team filters which roles are offered.
  const locationBranches = branches.filter((b) => (b.kind ?? "branch") !== "office");
  const officeBranches = branches.filter((b) => b.kind === "office");
  const [branchId, setBranchId] = useState(defaults?.branch_id ?? "");
  const selectedBranch = branches.find((b) => b.id === branchId);
  const targetTeam = selectedBranch?.kind === "office" ? "office" : "care";
  const visibleRoles = roles.filter((r) => (r.team ?? "care") === targetTeam);

  // Role drives the default workflow; the workflow can then be changed.
  const [roleId, setRoleId] = useState(defaults?.role_id ?? "");
  const [workflowRoleId, setWorkflowRoleId] = useState(
    defaults?.workflow_role_id ?? defaults?.role_id ?? ""
  );
  const [wfTouched, setWfTouched] = useState(false);

  return (
    <form
      action={formAction}
      onChange={() => setDirty(true)}
      className="space-y-5"
    >
      <FormError error={state?.error} />
      {defaults?.id && <input type="hidden" name="id" value={defaults.id} />}

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
          Job title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={defaults?.title}
          placeholder="e.g. Care Assistant"
          className={inputClass}
        />
      </div>

      {owners.length > 0 && (
        <div>
          <label htmlFor="owner_id" className="block text-sm font-medium text-gray-700">
            Managed by
          </label>
          <select
            id="owner_id"
            name="owner_id"
            defaultValue={defaults?.owner_id ?? ""}
            className={inputClass}
          >
            {!defaults?.owner_id && <option value="">Select role owner</option>}
            {owners.map((o) => (
              <option key={o.user_id} value={o.user_id}>
                {o.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            The owner receives the notifications for this job&apos;s applicants. You can transfer this any time (e.g. for cover during leave).
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="employment_type" className="block text-sm font-medium text-gray-700">
            Employment type
          </label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={defaults?.employment_type ?? "Full time"}
            className={inputClass}
          >
            {EMPLOYMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="branch_id" className="block text-sm font-medium text-gray-700">
            Recruiting for
          </label>
          <select
            id="branch_id"
            name="branch_id"
            value={branchId}
            onChange={(e) => {
              const newId = e.target.value;
              setBranchId(newId);
              setDirty(true);
              // If the current role doesn't belong to the new target's team, clear it.
              const newBranch = branches.find((b) => b.id === newId);
              const newTeam = newBranch?.kind === "office" ? "office" : "care";
              const current = roles.find((r) => r.id === roleId);
              if (current && (current.team ?? "care") !== newTeam) {
                setRoleId("");
                if (!wfTouched) setWorkflowRoleId("");
              }
            }}
            className={inputClass}
          >
            <option value="">Select where you&apos;re recruiting…</option>
            {locationBranches.length > 0 && (
              <optgroup label="Branches">
                {locationBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
            {officeBranches.length > 0 && (
              <optgroup label="Office">
                {officeBranches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {branches.length === 0
              ? "Add branches in Settings first."
              : "Choose a care branch or your Office Team. The role list adapts to your choice."}
          </p>
        </div>
        <div>
          <label htmlFor="role_id" className="block text-sm font-medium text-gray-700">
            Role
          </label>
          <select
            id="role_id"
            name="role_id"
            value={roleId}
            onChange={(e) => {
              setRoleId(e.target.value);
              if (!wfTouched) setWorkflowRoleId(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">{targetTeam === "office" ? "Select an office role…" : "Select a role…"}</option>
            {visibleRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {roles.length === 0
              ? "Add roles in Settings first."
              : "Follows the hire onto their employee record and drives the breakdown."}
          </p>
        </div>
        <div>
          <label htmlFor="workflow_role_id" className="block text-sm font-medium text-gray-700">
            Workflow
          </label>
          <select
            id="workflow_role_id"
            name="workflow_role_id"
            value={workflowRoleId}
            onChange={(e) => {
              setWfTouched(true);
              setWorkflowRoleId(e.target.value);
            }}
            className={inputClass}
          >
            <option value="">Match role</option>
            {visibleRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Which role&apos;s workflow tasks apply to applicants. Defaults to the role above — change if needed.
          </p>
        </div>
        <div>
          <label htmlFor="salary" className="block text-sm font-medium text-gray-700">
            Salary / rate
          </label>
          <input
            id="salary"
            name="salary"
            defaultValue={defaults?.salary}
            placeholder="e.g. £12.50 per hour"
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label htmlFor="vacancies" className="block text-sm font-medium text-gray-700">
              Vacancies
            </label>
            <input
              id="vacancies"
              name="vacancies"
              type="number"
              min={1}
              max={999}
              defaultValue={defaults?.vacancies ?? 1}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="closing_date" className="block text-sm font-medium text-gray-700">
              Closing date
            </label>
            <input
              id="closing_date"
              name="closing_date"
              type="date"
              defaultValue={defaults?.closing_date}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Job description
        </label>
        <textarea
          id="description"
          name="description"
          rows={10}
          defaultValue={defaults?.description}
          placeholder="Describe the role, responsibilities, requirements and benefits…"
          className={inputClass}
        />
      </div>

      <div>
        <label
          htmlFor="application_form_id"
          className="block text-sm font-medium text-gray-700"
        >
          Application form
        </label>
        <select
          id="application_form_id"
          name="application_form_id"
          defaultValue={defaults?.application_form_id ?? ""}
          className={inputClass}
        >
          <option value="">Select one</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {forms.length === 0
            ? "Optional. Only forms in the “Application forms” category appear here — set a form’s category to “Application forms” to use it. Otherwise applicants fill the built-in basics."
            : "Optional. Adds your custom questions on top of the built-in basics. Only forms in the “Application forms” category are listed."}
        </p>
      </div>

      <div className="sm:w-48">
        <SubmitButton disabled={!dirty}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
