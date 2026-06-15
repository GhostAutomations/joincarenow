"use server";

import { revalidatePath } from "next/cache";
import { requireCompany } from "@/modules/auth/queries";

export type EmployeeState = { error?: string; ok?: boolean } | undefined;

const STATUSES = ["active", "inactive", "left"] as const;

/** Update the editable fields of an employee's master record. */
export async function updateEmployee(
  _prev: EmployeeState,
  formData: FormData
): Promise<EmployeeState> {
  const id = formData.get("id")?.toString();
  if (!id) return { error: "Missing employee" };

  const status = formData.get("status")?.toString() ?? "active";
  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return { error: "Invalid status" };
  }
  const managerId = formData.get("managerId")?.toString() || null;
  const branchId = formData.get("branchId")?.toString() || null;

  const { supabase, current } = await requireCompany();

  // Snapshot the branch name so the breakdown is resilient to renames/deletes.
  let branchName: string | null = null;
  if (branchId) {
    const { data: b } = await supabase
      .from("branches")
      .select("name")
      .eq("id", branchId)
      .eq("company_id", current.company_id)
      .maybeSingle();
    branchName = b?.name ?? null;
  }

  const { error } = await supabase
    .from("employees")
    .update({
      employee_ref: formData.get("employeeRef")?.toString()?.trim() || null,
      job_title: formData.get("jobTitle")?.toString()?.trim() || null,
      department: formData.get("department")?.toString()?.trim() || null,
      branch_id: branchId,
      branch: branchName,
      worker_category: formData.get("workerCategory")?.toString()?.trim() || null,
      training_group: formData.get("trainingGroup")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      start_date: formData.get("startDate")?.toString() || null,
      manager_id: managerId,
      status,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);

  if (error) {
    if (error.code === "23505") return { error: "That employee number is already in use." };
    return { error: "Could not save. Please try again." };
  }

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}
