"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

function safeNext(next: FormDataEntryValue | null): string {
  return typeof next === "string" && next.startsWith("/") ? next : "/portal";
}

// ---------- Applicant sign up / sign in ----------

const signUpSchema = z.object({
  fullName: z.string().min(2, "Enter your full name").max(120),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type ApplicantAuthState = { error?: string } | undefined;

export async function applicantSignUp(
  _prev: ApplicantAuthState,
  formData: FormData
): Promise<ApplicantAuthState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) {
    if (/registered/i.test(error.message)) {
      return { error: "You already have an account — please sign in instead." };
    }
    return { error: error.message };
  }

  redirect(safeNext(formData.get("next")));
}

export async function applicantSignIn(
  _prev: ApplicantAuthState,
  formData: FormData
): Promise<ApplicantAuthState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Invalid email or password" };

  redirect(safeNext(formData.get("next")));
}

// ---------- Apply to a job ----------

const applySchema = z.object({
  jobId: z.string().uuid(),
  firstName: z.string().min(1, "First name is required").max(80),
  lastName: z.string().min(1, "Last name is required").max(80),
  phone: z.string().max(40).optional().or(z.literal("")),
  postcode: z.string().max(20).optional().or(z.literal("")),
  coverMessage: z.string().max(5000).optional().or(z.literal("")),
});

export type ApplyState = { error?: string } | undefined;

export async function applyToJob(
  _prev: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const parsed = applySchema.safeParse({
    jobId: formData.get("jobId"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone") ?? "",
    postcode: formData.get("postcode") ?? "",
    coverMessage: formData.get("coverMessage") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to apply." };

  // Optional CV upload → private bucket under the user's own folder.
  let cvPath: string | null = null;
  const cv = formData.get("cv");
  if (cv instanceof File && cv.size > 0) {
    if (cv.size > 5 * 1024 * 1024) {
      return { error: "Your CV must be 5MB or smaller." };
    }
    const safeName = cv.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${user.id}/${Date.now()}-${safeName}`;
    const bytes = await cv.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("applications")
      .upload(path, bytes, {
        contentType: cv.type || "application/octet-stream",
        upsert: false,
      });
    if (uploadError) return { error: "Could not upload your CV. Please try again." };
    cvPath = path;
  }

  const rightToWork = formData.get("rightToWork") === "on";

  const { error } = await supabase.rpc("apply_to_job", {
    p_job_id: parsed.data.jobId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone || null,
    p_postcode: parsed.data.postcode || null,
    p_cover_message: parsed.data.coverMessage || null,
    p_cv_path: cvPath,
    p_answers: { right_to_work: rightToWork },
  });

  if (error) return { error: error.message };

  redirect("/portal?applied=1");
}
