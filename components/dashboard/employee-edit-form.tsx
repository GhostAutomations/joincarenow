"use client";

import { useActionState, useEffect, useState } from "react";
import { updateEmployee, type EmployeeState } from "@/modules/employees/actions";

const cls =
  "mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export type EmployeeFields = {
  id: string;
  job_title: string | null;
  department: string | null;
  branch_id: string | null;
  worker_category: string | null;
  training_group: string | null;
  phone: string | null;
  start_date: string | null;
  manager_id: string | null;
  status: "active" | "inactive" | "left";
};

export function EmployeeEditForm({
  employee,
  managers,
  branches,
}: {
  employee: EmployeeFields;
  managers: { user_id: string; name: string }[];
  branches: { id: string; name: string }[];
}) {
  const [state, action] = useActionState<EmployeeState, FormData>(updateEmployee, undefined);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      setSaved(true);
      const t = setTimeout(() => setSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state]);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={employee.id} />
      {state?.error && (
        <p className="rounded-md bg-red-50 px-2.5 py-1.5 text-sm text-red-700">{state.error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="text-xs font-medium text-gray-600">
          Job role
          <input name="jobTitle" defaultValue={employee.job_title ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Department
          <input name="department" defaultValue={employee.department ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Branch
          <select name="branchId" defaultValue={employee.branch_id ?? ""} className={cls}>
            <option value="">No branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Worker category
          <input name="workerCategory" defaultValue={employee.worker_category ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Mobile number
          <input name="phone" defaultValue={employee.phone ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Start date
          <input name="startDate" type="date" defaultValue={employee.start_date ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Training group
          <input name="trainingGroup" defaultValue={employee.training_group ?? ""} className={cls} />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Manager
          <select name="managerId" defaultValue={employee.manager_id ?? ""} className={cls}>
            <option value="">No manager</option>
            {managers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-gray-600">
          Status
          <select name="status" defaultValue={employee.status} className={cls}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="left">Left</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
          Save changes
        </button>
        {saved && <span className="text-sm text-green-600">Saved</span>}
      </div>
    </form>
  );
}
