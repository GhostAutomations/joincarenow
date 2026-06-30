import { createAdminClient } from "@/lib/supabase/admin";
import { sendCompanySms, recordUsage } from "@/lib/billing/usage";
import { synthesizePoppyReport, type PoppyReportData } from "@/lib/ai/generate-poppy-report";
import { notifyJobOwner } from "@/lib/comms/notify-owner";
import { BASE_URL } from "@/lib/billing/stripe";

type Admin = ReturnType<typeof createAdminClient>;

type ConvApp = {
  id: string;
  company_id: string;
  applicant_id: string | null;
  cv_path: string | null;
  answers: unknown;
  cover_message: string | null;
  applicants: { first_name: string | null; last_name: string | null; phone: string | null } | null;
  jobs: { title: string | null; description: string | null } | null;
  companies: { name: string | null } | null;
};

async function loadConvApp(db: Admin, applicationId: string): Promise<ConvApp | null> {
  const { data } = await db
    .from("applications")
    .select("id, company_id, applicant_id, cv_path, answers, cover_message, applicants(first_name, last_name, phone), jobs(title, description), companies(name)")
    .eq("id", applicationId)
    .maybeSingle();
  return (data as unknown as ConvApp) ?? null;
}

const firstName = (app: ConvApp) => (app.applicants?.first_name || "there").trim();
const companyName = (app: ConvApp) => (app.companies?.name || "the team").trim();

/** Post a message from Poppy into the applicant's portal conversation thread. */
async function postPoppyMessage(db: Admin, app: ConvApp, body: string): Promise<void> {
  await db.from("messages").insert({
    company_id: app.company_id,
    application_id: app.id,
    applicant_id: app.applicant_id,
    channel: "portal",
    direction: "outbound",
    from_poppy: true,
    body: body.slice(0, 2000),
    status: "delivered",
  });
}

/**
 * Start the screening conversation once analysis is done: post Poppy's consent
 * message into the portal thread and send ONE nudge SMS with a link. Idempotent
 * — only acts on a report still in phase 'analysed'.
 */
export async function startPoppyConversation(db: Admin, applicationId: string): Promise<void> {
  const { data: rep } = await db
    .from("poppy_reports")
    .select("phase, report")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!rep || rep.phase !== "analysed") return;

  const data = (rep.report as PoppyReportData) ?? { summary: "", concerns: [], questions: [] };
  const app = await loadConvApp(db, applicationId);
  if (!app) return;

  // Nothing to ask → no conversation needed; mark complete.
  if (!data.questions?.length) {
    await db.from("poppy_reports").update({ phase: "complete" }).eq("application_id", applicationId);
    return;
  }

  const name = firstName(app);
  const co = companyName(app);

  await postPoppyMessage(
    db,
    app,
    `Hi ${name}, it's Poppy from ${co}. I've a few quick questions about your application to help move things along. Is it OK to ask you a few now? Reply YES to start — or STOP to opt out at any time.`
  );

  // One nudge SMS to bring them to the portal (the conversation itself is free).
  const phone = app.applicants?.phone?.trim();
  if (phone) {
    const link = `${BASE_URL}/portal/conversations/${applicationId}`;
    await sendCompanySms(app.company_id, {
      to: phone,
      body: `Hi ${name}, it's Poppy from ${co} — I've a few quick questions about your application. Tap to answer in your portal: ${link}`,
    });
  }

  await db
    .from("poppy_reports")
    .update({ phase: "conversing", consent: "asked", current_q: 0, sms_sent_at: new Date().toISOString() })
    .eq("application_id", applicationId);
}

const isOptOut = (t: string) => /\b(stop|unsubscribe|opt ?out)\b/i.test(t);
const isNegative = (t: string) => /^\s*(no|nope|not now|not really|no thanks|na|nah)\b/i.test(t);
const isAffirmative = (t: string) => /\b(yes|yeah|yep|yup|ok|okay|sure|go ahead|happy|fine|sounds good|please)\b/i.test(t);

async function askQuestion(db: Admin, app: ConvApp, data: PoppyReportData, idx: number, lead = ""): Promise<void> {
  const q = data.questions[idx];
  if (!q) return;
  await postPoppyMessage(db, app, `${lead}${q.question}`);
  await db.from("poppy_reports").update({ current_q: idx }).eq("application_id", app.id);
}

async function decline(db: Admin, app: ConvApp, ownerNote: string): Promise<void> {
  await postPoppyMessage(db, app, "No problem at all — thanks anyway. The team will be in touch.");
  await db.from("poppy_reports").update({ phase: "declined", consent: "no" }).eq("application_id", app.id);
  await notifyJobOwner(db, {
    applicationId: app.id,
    type: "poppy_declined",
    prefKey: "applicant_message",
    title: `Poppy screening not completed: ${firstName(app)}`,
    body: ownerNote,
    link: "/pipeline",
    email: {
      subject: `Poppy screening not completed for ${firstName(app)}`,
      text: `${ownerNote} You may want to follow up with the applicant directly.`,
      ctaLabel: "Open pipeline",
      ctaUrl: `${BASE_URL}/pipeline`,
    },
  });
}

/** Build a light synthesis input (the Q&A + concerns carry the weight). */
function answersText(app: ConvApp): string | null {
  if (!app.answers || typeof app.answers !== "object") return app.cover_message ?? null;
  const lines = Object.entries(app.answers as Record<string, unknown>)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v)}`);
  return lines.length ? lines.join("\n") : app.cover_message ?? null;
}

async function finish(db: Admin, app: ConvApp, data: PoppyReportData): Promise<void> {
  try {
    const synth = await synthesizePoppyReport(
      {
        jobTitle: app.jobs?.title ?? "Care role",
        jobDescription: app.jobs?.description ?? "",
        applicantName: [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ") || "the candidate",
        coverMessage: app.cover_message,
        answersText: answersText(app),
        cvBase64Pdf: null,
      },
      data.concerns,
      data.questions
    );
    data.summary = synth.summary || data.summary;
    data.recommendation = synth.recommendation;
    await recordUsage(app.company_id, "ai");
  } catch {
    // Still complete the conversation even if synthesis fails — the Q&A stands.
    data.recommendation = data.recommendation ?? "";
  }

  await db
    .from("poppy_reports")
    .update({ phase: "complete", report: data, generated_at: new Date().toISOString() })
    .eq("application_id", app.id);

  await postPoppyMessage(db, app, "Thank you — that's everything I needed. The team will review your application and be in touch.");

  await notifyJobOwner(db, {
    applicationId: app.id,
    type: "poppy_report",
    prefKey: "new_application",
    title: `Poppy screening complete: ${firstName(app)}`,
    body: data.recommendation?.slice(0, 160) || null,
    link: "/pipeline",
    email: {
      subject: `Poppy screening complete for ${firstName(app)}`,
      text: `Poppy has finished screening ${firstName(app)} and recorded their answers. Open the pipeline to read the report.`,
      ctaLabel: "Open pipeline",
      ctaUrl: `${BASE_URL}/pipeline`,
    },
  });
}

/**
 * Handle an applicant's portal reply as part of a Poppy screening conversation.
 * No-op unless that application has an active conversation (phase 'conversing').
 * Returns true if Poppy handled the reply (so the caller can skip the normal
 * "new message" owner notification).
 */
export async function handlePoppyReply(db: Admin, applicationId: string, replyText: string): Promise<boolean> {
  const { data: rep } = await db
    .from("poppy_reports")
    .select("phase, consent, current_q, report")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!rep || rep.phase !== "conversing") return false;

  const app = await loadConvApp(db, applicationId);
  if (!app) return false;
  const data = (rep.report as PoppyReportData) ?? { summary: "", concerns: [], questions: [] };
  const text = replyText.trim();

  // Opt-out at any point.
  if (isOptOut(text)) {
    await decline(db, app, "The applicant opted out of the screening conversation.");
    return true;
  }

  // Consent step.
  if (rep.consent === "asked") {
    if (isNegative(text) && !isAffirmative(text)) {
      await decline(db, app, "The applicant declined to answer screening questions.");
      return true;
    }
    await db.from("poppy_reports").update({ consent: "yes" }).eq("application_id", applicationId);
    await askQuestion(db, app, data, 0, "Great, thank you! ");
    return true;
  }

  // Answer step — record the answer to the current question, then advance.
  const idx = rep.current_q ?? 0;
  if (data.questions[idx]) data.questions[idx].answer = text.slice(0, 2000);
  const next = idx + 1;
  await db
    .from("poppy_reports")
    .update({ report: data, current_q: next, last_applicant_reply_at: new Date().toISOString() })
    .eq("application_id", applicationId);

  if (next < data.questions.length) {
    await askQuestion(db, app, data, next, "Thanks. ");
  } else {
    await finish(db, app, data);
  }
  return true;
}
