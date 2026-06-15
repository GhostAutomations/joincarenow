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

  const { supabase, current } = await requireCompany();
  const { error } = await supabase
    .from("employees")
    .update({
      job_title: formData.get("jobTitle")?.toString()?.trim() || null,
      department: formData.get("department")?.toString()?.trim() || null,
      location: formData.get("location")?.toString()?.trim() || null,
      region: formData.get("region")?.toString()?.trim() || null,
      worker_category: formData.get("workerCategory")?.toString()?.trim() || null,
      training_group: formData.get("trainingGroup")?.toString()?.trim() || null,
      phone: formData.get("phone")?.toString()?.trim() || null,
      start_date: formData.get("startDate")?.toString() || null,
      manager_id: managerId,
      status,
    })
    .eq("id", id)
    .eq("company_id", current.company_id);

  if (error) return { error: "Could not save. Please try again." };

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  return { ok: true };
}
