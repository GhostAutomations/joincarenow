"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBrandedEmail } from "@/lib/comms/branded";
import { sendCompanySms } from "@/lib/billing/usage";
import { londonToUtcIso, formatLondon } from "@/lib/time";
import { isWithinOpeningHours, type OpeningHours } from "@/lib/opening-hours";
import { buildIcs, calendarLinks, type CalEvent } from "@/lib/calendar/ics";

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
  interviewerId: z.string().uuid().optional().or(z.literal("")),
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
    interviewerId: formData.get("interviewerId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();

  // Enforce opening hours (server-side safety net).
  const { data: appco } = await supabase
    .from("applications")
    .select("companies(settings)")
    .eq("id", parsed.data.applicationId)
    .single();
  const oh = (appco?.companies as unknown as { settings?: { opening_hours?: OpeningHours } } | null)
    ?.settings?.opening_hours;
  const dPart = parsed.data.scheduledAt.slice(0, 10);
  const tPart = parsed.data.scheduledAt.slice(11, 16);
  if (!isWithinOpeningHours(oh, dPart, tPart)) {
    return { error: "That time is outside your office opening hours. Update them in Settings if needed." };
  }

  const { data: iv, error } = await supabase.rpc("schedule_interview", {
    p_application_id: parsed.data.applicationId,
    p_scheduled_at: londonToUtcIso(parsed.data.scheduledAt),
    p_duration_minutes: parsed.data.durationMinutes,
    p_mode: parsed.data.mode,
    p_location: parsed.data.location || null,
    p_channel: parsed.data.channel,
    p_interviewer_id: parsed.data.interviewerId || null,
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
      .select("company_id, applicant_id, applicants(first_name, last_name, email, phone), jobs(title), companies(name)")
      .eq("id", applicationId)
      .single();
    if (!app) return;

    const ap = app.applicants as unknown as {
      first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
    } | null;
    const company = (app.companies as unknown as { name: string | null } | null)?.name ?? "the team";
    const jobTitle = (app.jobs as unknown as { title: string | null } | null)?.title ?? "the role";
    const link = `${BASE_URL}/interview/${iv.respond_token}`;
    const when = formatLondon(iv.scheduled_at);
    const first = ap?.first_name || "there";
    const applicantName = [ap?.first_name, ap?.last_name].filter(Boolean).join(" ") || "the candidate";
    const modeText = iv.mode === "phone" ? "by phone" : iv.mode === "video" ? "by video call" : "in person";
    const whereLine = iv.location ? `\nWhere: ${iv.location}` : "";
    // In-person interviews: the applicant must bring proof of Right to Work.
    const rtwLine =
      iv.mode === "in_person"
        ? "\n\nImportant: please bring proof of your Right to Work in the UK (for example your passport, or your Home Office share code) to your interview."
        : "";
    const rtwSms = iv.mode === "in_person" ? " Please bring proof of your Right to Work (e.g. passport)." : "";

    // Calendar event (used for the applicant's invite + the interviewer's email).
    const startIso = new Date(iv.scheduled_at).toISOString();
    const calLocation =
      iv.mode === "phone" ? "Phone call" : iv.mode === "video" ? "Video call" : iv.location || "In person";
    const baseEvent: Omit<CalEvent, "uid" | "title" | "description"> = {
      startIso,
      durationMinutes: iv.duration_minutes,
      location: calLocation,
    };
    const calNote = "\n\nA calendar invite is attached to this email.";

    const emailSubject =
      variant === "confirmed"
        ? `Your interview with ${company} is confirmed`
        : `Interview invitation from ${company}`;
    const emailBody =
      variant === "confirmed"
        ? `Hi ${first},\n\nGood news — your interview with ${company} is confirmed.\n\n` +
          `When: ${when} (${iv.duration_minutes} minutes, ${modeText})${whereLine}${rtwLine}\n\n` +
          `If you need to change anything, use the button below.\n\nSee you then,\n${company}`
        : `Hi ${first},\n\n${company} would like to invite you to an interview.\n\n` +
          `When: ${when} (${iv.duration_minutes} minutes, ${modeText})${whereLine}${rtwLine}\n\n` +
          `Use the buttons below to confirm, ask to change the time, or decline.\n\nThank you,\n${company}`;
    const smsBody =
      variant === "confirmed"
        ? `Hi ${first}, your interview with ${company} is confirmed for ${when} (${modeText}).${rtwSms} Need to change it? ${link}`
        : `Hi ${first}, ${company} would like to interview you on ${when} (${modeText}).${rtwSms} Confirm/change/decline: ${link}`;

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

    // Applicant calendar invite (.ics + links).
    const applicantEvent: CalEvent = {
      ...baseEvent,
      uid: iv.respond_token,
      title: `Interview — ${company}`,
      description: `Interview for ${jobTitle} (${modeText}). Manage your interview: ${link}`,
    };
    const applicantIcs = Buffer.from(buildIcs(applicantEvent)).toString("base64");
    const applicantLinks = calendarLinks(applicantEvent);

    if ((channel === "email" || channel === "both") && ap?.email) {
      const bodyWithCal = emailBody + calNote;
      const r = await sendBrandedEmail(supabase, app?.company_id, {
        to: ap.email,
        subject: emailSubject,
        text: bodyWithCal,
        ctas: [
          { label: variant === "confirmed" ? "Manage your interview" : "Respond to invitation", url: link },
          { label: "Add to Google", url: applicantLinks.google, style: "ghost" },
          { label: "Add to Outlook", url: applicantLinks.outlook, style: "ghost" },
        ],
        attachments: [{ filename: "interview.ics", content: applicantIcs }],
      });
      await log("email", ap.email, emailSubject, bodyWithCal, r.ok ? "sent" : "failed", r.id, r.ok ? undefined : r.error);
    }
    if ((channel === "sms" || channel === "both")) {
      const phone = ukPhone(ap?.phone ?? null);
      if (phone) {
        const r = await sendCompanySms(app?.company_id, { to: phone, body: smsBody }, { label: "Interview", actorId: user?.id ?? null });
        await log("sms", phone, null, smsBody, r.ok ? "sent" : "failed", r.id, r.ok ? undefined : r.error);
      }
    }

    // Email the selected interviewer their own calendar invite (always, since the
    // scheduler may not be the interviewer). Self-contained so a lookup hiccup
    // can never block the applicant's invite above.
    try {
      const { data: ivMeta } = await supabase
        .from("interviews")
        .select("interviewer_id")
        .eq("application_id", applicationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (ivMeta?.interviewer_id) {
        const { data: m } = await supabase
          .from("company_users")
          .select("profiles ( full_name, email )")
          .eq("company_id", app.company_id)
          .eq("user_id", ivMeta.interviewer_id)
          .maybeSingle();
        const p = m?.profiles as unknown as { full_name: string | null; email: string | null } | null;
        let interviewerEmail = p?.email ?? null;
        const interviewerName = p?.full_name ?? null;
        // profiles.email is often blank for staff — fall back to their auth email.
        if (!interviewerEmail) {
          try {
            const admin = createAdminClient();
            const { data: au } = await admin.auth.admin.getUserById(ivMeta.interviewer_id);
            interviewerEmail = au?.user?.email ?? null;
          } catch {
            /* ignore */
          }
        }
        if (interviewerEmail) {
          const interviewerEvent: CalEvent = {
            ...baseEvent,
            uid: `${iv.respond_token}-interviewer`,
            title: `Interview: ${applicantName} — ${jobTitle}`,
            description:
              `You're interviewing ${applicantName} for ${jobTitle} (${modeText}).` +
              (ap?.email ? `\nCandidate email: ${ap.email}` : "") +
              (ap?.phone ? `\nCandidate phone: ${ap.phone}` : ""),
          };
          const interviewerIcs = Buffer.from(buildIcs(interviewerEvent)).toString("base64");
          const il = calendarLinks(interviewerEvent);
          const hi = interviewerName ? interviewerName.split(" ")[0] : "there";
          const interviewerBody =
            `Hi ${hi},\n\nYou're scheduled to interview ${applicantName} for the ${jobTitle} role at ${company}.\n\n` +
            `When: ${when} (${iv.duration_minutes} minutes, ${modeText})${whereLine}\n` +
            (ap?.email ? `Candidate email: ${ap.email}\n` : "") +
            (ap?.phone ? `Candidate phone: ${ap.phone}\n` : "") +
            calNote;
          const subj = `Interview scheduled: ${applicantName} — ${jobTitle}`;
          const r = await sendBrandedEmail(supabase, app.company_id, {
            to: interviewerEmail,
            subject: subj,
            text: interviewerBody,
            ctas: [
              { label: "Add to Google", url: il.google, style: "ghost" },
              { label: "Add to Outlook", url: il.outlook, style: "ghost" },
            ],
            attachments: [{ filename: "interview.ics", content: interviewerIcs }],
          });
          await log("email", interviewerEmail, `[Interviewer] ${subj}`, interviewerBody, r.ok ? "sent" : "failed", r.id, r.ok ? undefined : r.error);
        }
      }
    } catch {
      /* interviewer email is best-effort */
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

  let iso: string;
  try {
    iso = londonToUtcIso(iv.requested_time);
  } catch {
    return { error: "Couldn't read the proposed time" };
  }

  const { data: row, error } = await supabase.rpc("confirm_interview_at", {
    p_application_id: applicationId,
    p_scheduled_at: iso,
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
