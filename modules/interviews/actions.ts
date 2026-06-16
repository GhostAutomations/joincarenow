"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, sendSms } from "@/lib/comms/send";

const BASE_URL = "https://www.joincarenow.com";

function ukPhone(raw: string | null): string | null {
  if (!raw) return null;
  const t = raw.replace(/[\s()-]/g, "");
  if (t.startsWith("+")) return t;
  if (t.startsWith("0")) return "+44" + t.slice(1);
  if (t.startsWith("44")) return "+" + t;
  return t;
}

const RESPONSE_LABEL: Record<string, string> = {
  confirm: "confirmed their interview",
  confirmed: "confirmed their interview",
  accept: "confirmed their interview",
  decline: "declined their interview",
  declined: "declined their interview",
  reschedule: "requested a new interview time",
  reschedule_requested: "requested a new interview time",
};

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
  const { data: iv, error } = await supabase.rpc("schedule_interview", {
    p_application_id: parsed.data.applicationId,
    p_scheduled_at: new Date(parsed.data.scheduledAt).toISOString(),
    p_duration_minutes: parsed.data.durationMinutes,
    p_mode: parsed.data.mode,
    p_location: parsed.data.location || null,
    p_channel: parsed.data.channel,
  });
  if (error) return { error: error.message };

  // Send the invite (with a one-tap response link) and log it to the timeline.
  await sendInterviewInvite(supabase, parsed.data.applicationId, iv, parsed.data.channel);

  revalidatePath("/pipeline");
  return { ok: true };
}

type IvRow = {
  respond_token: string;
  scheduled_at: string;
  duration_minutes: number;
  mode: string | null;
  location: string | null;
};

/** Email/SMS the applicant their interview invite (or a confirmation). */
async function sendInterviewInvite(
  supabase: Awaited<ReturnType<typeof createClient>>,
  applicationId: string,
  iv: IvRow | null,
  channel: string,
  variant: "invite" | "confirmed" = "invite"
) {
  if (!iv?.respond_token) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: app } = await supabase
      .from("applications")
      .select("company_id, applicant_id, applicants(first_name, email, phone), jobs(title), companies(name)")
      .eq("id", applicationId)
      .single();
    if (!app) return;

    const ap = app.applicants as unknown as {
      first_name: string | null; email: string | null; phone: string | null;
    } | null;
    const company = (app.companies as unknown as { name: string | null } | null)?.name ?? "the team";
    const link = `${BASE_URL}/interview/${iv.respond_token}`;
    const when = new Date(iv.scheduled_at).toLocaleString("en-GB", {
      dateStyle: "full", timeStyle: "short",
    });
    const first = ap?.first_name || "there";
    const modeText = iv.mode === "phone" ? "by phone" : iv.mode === "video" ? "by video call" : "in person";
    const whereLine = iv.location ? `\nWhere: ${iv.location}` : "";

    const emailSubject =
      variant === "confirmed"
        ? `Your interview with ${company} is confirmed`
        : `Interview invitation from ${company}`;
    const emailBody =
      variant === "confirmed"
        ? `Hi ${first},\n\nGood news — your interview with ${company} is confirmed.\n\n` +
          `When: ${when} (${iv.duration_minutes} minutes, ${modeText})${whereLine}\n\n` +
          `If you need to change anything, use this link:\n${link}\n\nSee you then,\n${company}`
        : `Hi ${first},\n\n${company} would like to invite you to an interview.\n\n` +
          `When: ${when} (${iv.duration_minutes} minutes, ${modeText})${whereLine}\n\n` +
          `Please confirm, ask to change the time, or decline here:\n${link}\n\nThank you,\n${company}`;
    const smsBody =
      variant === "confirmed"
        ? `Hi ${first}, your interview with ${company} is confirmed for ${when} (${modeText}). Need to change it? ${link}`
        : `Hi ${first}, ${company} would like to interview you on ${when} (${modeText}). Confirm/change/decline: ${link}`;

    async function log(ch: "email" | "sms", to: string, subject: string | null, body: string, status: string, providerId?: string, err?: string) {
      await supabase.from("messages").insert({
        company_id: app!.company_id,
        application_id: applicationId,
        applicant_id: app!.applicant_id,
        channel: ch,
        direction: "outbound",
        to_address: to,
        subject,
        body,
        status,
        provider_id: providerId ?? null,
        error: err ?? null,
        created_by: user?.id ?? null,
      });
    }

    if ((channel === "email" || channel === "both") && ap?.email) {
      const r = await sendEmail({ to: ap.email, subject: emailSubject, text: emailBody });
      await log("email", ap.email, emailSubject, emailBody, r.ok ? "sent" : "failed", r.id, r.ok ? undefined : r.error);
    }
    if ((channel === "sms" || channel === "both")) {
      const phone = ukPhone(ap?.phone ?? null);
      if (phone) {
        const r = await sendSms({ to: phone, body: smsBody });
        await log("sms", phone, null, smsBody, r.ok ? "sent" : "failed", r.id, r.ok ? undefined : r.error);
      }
    }
  } catch {
    /* don't fail scheduling if the invite send hiccups */
  }
}

/** Staff: accept the applicant's proposed time in one click (confirms it). */
export async function acceptInterviewTime(
  applicationId: string
): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: iv } = await supabase
    .from("interviews")
    .select("requested_time")
    .eq("application_id", applicationId)
    .single();
  if (!iv?.requested_time) return { error: "No proposed time to accept" };

  const d = new Date(iv.requested_time);
  if (isNaN(d.getTime())) return { error: "Couldn't read the proposed time" };

  const { data: row, error } = await supabase.rpc("confirm_interview_at", {
    p_application_id: applicationId,
    p_scheduled_at: d.toISOString(),
  });
  if (error) return { error: error.message };

  // Send the applicant a confirmation for the agreed time.
  await sendInterviewInvite(supabase, applicationId, row, (row as IvRow & { channel?: string }).channel ?? "email", "confirmed");

  revalidatePath("/pipeline");
  return { ok: true };
}

/** Public (token) interview response — used by the one-tap link, no login. */
export async function respondToInterviewByToken(
  token: string,
  response: string,
  requestedTime?: string,
  note?: string
): Promise<{ ok?: boolean; error?: string }> {
  if (!["confirmed", "reschedule_requested", "declined"].includes(response)) {
    return { error: "Invalid response" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_to_interview_by_token", {
    p_token: token,
    p_response: response,
    p_requested_time: requestedTime ?? null,
    p_note: note ?? null,
  });
  if (error) return { error: "Could not save your response. The link may have expired." };

  const row = (data as { company_id: string; application_id: string; applicant_name: string | null }[])?.[0];
  if (row) {
    const what = RESPONSE_LABEL[response] ?? "responded to their interview invite";
    const name = row.applicant_name || "An applicant";
    try {
      const admin = createAdminClient();
      const { data: members } = await admin
        .from("company_users").select("user_id").eq("company_id", row.company_id);
      if (members?.length) {
        await admin.from("notifications").insert(
          members.map((m) => ({
            company_id: row.company_id,
            user_id: m.user_id,
            type: "interview_response",
            title: `${name} ${what}`,
            body: null,
            link: `/pipeline?open=${row.application_id}`,
          }))
        );
      }
    } catch { /* notification best-effort */ }
  }
  return { ok: true };
}

// ---------- Applicant: respond ----------

export async function respondToInterview(formData: FormData) {
  const interviewId = formData.get("interviewId");
  const response = formData.get("response");
  if (typeof interviewId !== "string" || typeof response !== "string") return;

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_interview", {
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

  if (!error) await notifyInterviewResponse(interviewId, response);

  revalidatePath("/portal");
}

/** Tell the company's team that an applicant responded to their interview. */
async function notifyInterviewResponse(interviewId: string, response: string) {
  try {
    const admin = createAdminClient();
    const { data: iv } = await admin
      .from("interviews")
      .select("application_id, company_id, applications(applicant_id, applicants(first_name, last_name))")
      .eq("id", interviewId)
      .single();
    if (!iv?.company_id) return;

    const appl = (iv.applications as unknown as {
      applicants: { first_name: string | null; last_name: string | null } | null;
    } | null)?.applicants;
    const name = [appl?.first_name, appl?.last_name].filter(Boolean).join(" ") || "An applicant";
    const what = RESPONSE_LABEL[response] ?? "responded to their interview invite";

    const { data: members } = await admin
      .from("company_users")
      .select("user_id")
      .eq("company_id", iv.company_id);
    if (!members?.length) return;

    await admin.from("notifications").insert(
      members.map((m) => ({
        company_id: iv.company_id,
        user_id: m.user_id,
        type: "interview_response",
        title: `${name} ${what}`,
        body: null,
        link: `/pipeline?open=${iv.application_id}`,
      }))
    );
  } catch {
    /* notification failure shouldn't block the applicant's response */
  }
}
