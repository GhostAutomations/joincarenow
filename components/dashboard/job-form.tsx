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
  contracts = [],
  policies = [],
}: {
  action: Action;
  defaults?: JobDefaults;
  submitLabel: string;
  forms?: { id: string; name: string }[];
  branches?: { id: string; name: string }[];
  roles?: { id: string; name: string }[];
  contracts?: { id: string; name: string }[];
  policies?: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState<JobState, FormData>(action, undefined);

  // Role drives the default workflow; the workflow can then be changed.
  const [roleId, setRoleId] = useState(defaults?.role_id ?? "");
  const [workflowRoleId, setWorkflowRoleId] = useState(
    defaults?.workflow_role_id ?? defaults?.role_id ?? ""
  );
  const [wfTouched, setWfTouched] = useState(false);

  return (
    <form action={formAction} className="space-y-5">
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
            Branch
          </label>
          <select
            id="branch_id"
            name="branch_id"
            defaultValue={defaults?.branch_id ?? ""}
            className={inputClass}
          >
            <option value="">Select a branch…</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {branches.length === 0
              ? "Add branches in Settings first."
              : "Shown as the job location and used to group employees once hired."}
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
            <option value="">Select a role…</option>
            {roles.map((r) => (
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
            {roles.map((r) => (
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
          <option value="">Built-in basics only (name, contact, CV)</option>
          {forms.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Optional. Adds your custom questions on top of the built-in basics.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="contract_template_id" className="block text-sm font-medium text-gray-700">
            Contract
          </label>
          <select
            id="contract_template_id"
            name="contract_template_id"
            defaultValue={defaults?.contract_template_id ?? ""}
            className={inputClass}
          >
            <option value="">No contract</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {contracts.length === 0
              ? "Build contract templates in Settings first."
              : "The contract the applicant signs when they accept their offer."}
          </p>
        </div>
        <div>
          <span className="block text-sm font-medium text-gray-700">Policies to acknowledge</span>
          {policies.length === 0 ? (
            <p className="mt-1 text-xs text-gray-500">Build policy documents in Settings first.</p>
          ) : (
            <div className="mt-1 space-y-1.5 rounded-lg border border-gray-300 px-3 py-2">
              {policies.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    name="policy_ids"
                    value={p.id}
                    defaultChecked={defaults?.policy_ids?.includes(p.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  {p.name}
                </label>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-500">
            The applicant acknowledges each ticked policy when they accept.
          </p>
        </div>
      </div>

      <div className="sm:w-48">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
