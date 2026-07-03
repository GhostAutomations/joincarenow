"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyJobOwner } from "@/lib/comms/notify-owner";

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

  // Collect custom application-form answers (inputs named field_<id>).
  const formAnswers: Record<string, unknown> = {};
  const fieldKeys = new Set<string>();
  for (const key of formData.keys()) {
    if (key.startsWith("field_")) fieldKeys.add(key);
  }
  for (const key of fieldKeys) {
    const fieldId = key.slice("field_".length);
    const values = formData.getAll(key);
    const files = values.filter(
      (v): v is File => v instanceof File && v.size > 0
    );
    if (files.length > 0) {
      const paths: string[] = [];
      for (const f of files) {
        if (f.size > 5 * 1024 * 1024) {
          return { error: `"${f.name}" is larger than 5MB.` };
        }
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("applications")
          .upload(path, await f.arrayBuffer(), {
            contentType: f.type || "application/octet-stream",
            upsert: false,
          });
        if (upErr) return { error: "Could not upload an attachment. Please try again." };
        paths.push(path);
      }
      formAnswers[fieldId] = paths.length === 1 ? paths[0] : paths;
    } else {
      const strs = values.filter(
        (v): v is string => typeof v === "string" && v !== ""
      );
      if (strs.length === 0) continue;

      // A signature arrives as a data: URL — upload it as a PNG.
      const dataUrl = strs.find((s) => s.startsWith("data:image/"));
      if (dataUrl) {
        const m = dataUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (m) {
          const buf = Buffer.from(m[1], "base64");
          if (buf.byteLength > 0 && buf.byteLength <= 2 * 1024 * 1024) {
            const path = `${user.id}/signature-${Date.now()}.png`;
            const { error: sigErr } = await supabase.storage
              .from("applications")
              .upload(path, buf, { contentType: "image/png", upsert: false });
            if (!sigErr) formAnswers[fieldId] = path;
          }
        }
        continue;
      }

      formAnswers[fieldId] = strs.length === 1 ? strs[0] : strs;
    }
  }

  // Combine a registration field's companion inputs (number + optional card
  // photo) into one answer, e.g. { number: "W/123", card: "<path>" }.
  for (const key of Object.keys(formAnswers)) {
    if (!key.endsWith("__card") && !key.endsWith("__nocard")) continue;
    const base = key.replace(/__(card|nocard)$/, "");
    const cur = formAnswers[base];
    const obj: { number: string; card?: string } =
      cur && typeof cur === "object" && !Array.isArray(cur)
        ? (cur as { number: string; card?: string })
        : { number: typeof cur === "string" ? cur : "" };
    if (key.endsWith("__card") && typeof formAnswers[key] === "string") obj.card = formAnswers[key] as string;
    formAnswers[base] = obj;
    delete formAnswers[key];
  }

  const { data: newAppId, error } = await supabase.rpc("apply_to_job", {
    p_job_id: parsed.data.jobId,
    p_first_name: parsed.data.firstName,
    p_last_name: parsed.data.lastName,
    p_phone: parsed.data.phone || null,
    p_postcode: parsed.data.postcode || null,
    p_cover_message: parsed.data.coverMessage || null,
    p_cv_path: cvPath,
    p_answers: { right_to_work: rightToWork },
    p_form_answers: formAnswers,
  });

  if (error) return { error: error.message };

  // Notify the job's owner of the new applicant (in-app + email). Best-effort.
  if (newAppId) {
    const name = `${parsed.data.firstName} ${parsed.data.lastName}`.trim();
    await notifyJobOwner(createAdminClient(), {
      applicationId: newAppId as string,
      type: "new_application",
      prefKey: "new_application",
      title: `New application from ${name}`,
      body: "Applied for one of your jobs.",
      link: `/pipeline?open=${newAppId}`,
      email: {
        subject: `New applicant: ${name}`,
        text: `${name} has applied for one of your jobs on Join Care Now. Use the button below to review their application.`,
        ctaLabel: "View applicant",
        ctaUrl: `https://www.joincarenow.com/pipeline?open=${newAppId}`,
      },
    });
  }

  redirect("/portal?applied=1");
}
