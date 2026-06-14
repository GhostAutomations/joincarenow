"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// ---------- Staff: schedule / reschedule ----------

const scheduleSchema = z.object({
  applicationId: z.string().uuid(),
  scheduledAt: z.string().min(1, "Pick a date and time"),
  durationMinutes: z.coerce.number().int().min(5).max(480).default(30),
  mode: z.enum(["in_person", "phone", "video"]).default("in_person"),
  location: z.string().max(300).optional().or(z.literal("")),
  channel: z.enum(["sms", "email", "both"]).default("email"),
});

export type ScheduleState = { error?: string; ok?: boolean } | undefined;

export async function scheduleInterview(
  _prev: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const parsed = scheduleSchema.safeParse({
    applicationId: formData.get("applicationId"),
    scheduledAt: formData.get("scheduledAt"),
    durationMinutes: formData.get("durationMinutes") ?? 30,
    mode: formData.get("mode") ?? "in_person",
    location: formData.get("location") ?? "",
    channel: formData.get("channel") ?? "email",
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.rpc("schedule_interview", {
    p_application_id: parsed.data.applicationId,
    p_scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
    p_duration_minutes: parsed.data.durationMinutes,
    p_mode: parsed.data.mode,
    p_location: parsed.data.location || null,
    p_channel: parsed.data.channel,
  });
  if (error) return { error: error.message };

  revalidatePath("/pipeline");
  return { ok: true };
}

// ---------- Applicant: respond ----------

export async function respondToInterview(formData: FormData) {
  const interviewId = formData.get("interviewId");
  const response = formData.get("response");
  if (typeof interviewId !== "string" || typeof response !== "string") return;

  const supabase = await createClient();
  await supabase.rpc("respond_to_interview", {
    p_interview_id: interviewId,
    p_response: response,
    p_requested_time:
      typeof formData.get("requestedTime") === "string"
        ? (formData.get("requestedTime") as string)
        : null,
    p_note:
      typeof formData.get("note") === "string"
        ? (formData.get("note") as string)
        : null,
  });

  revalidatePath("/portal");
}
