import { createAdminClient } from "@/lib/supabase/admin";
import { sendCompanySms } from "@/lib/billing/usage";
import { recordRubyApplicant } from "@/lib/billing/ruby-credits";
import { synthesizeRubyReport, generateRubyFollowUps, type RubyReportData } from "@/lib/ai/generate-ruby-report";
import { loadRubyRuntimeConfig } from "@/lib/ruby/config";
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

/** Post a message from Ruby into the applicant's portal conversation thread. */
async function postRubyMessage(db: Admin, app: ConvApp, body: string): Promise<void> {
  await db.from("messages").insert({
    company_id: app.company_id,
    application_id: app.id,
    applicant_id: app.applicant_id,
    channel: "portal",
    direction: "outbound",
    from_ruby: true,
    body: body.slice(0, 2000),
    status: "delivered",
  });
}

/**
 * Start the screening conversation once analysis is done: post Ruby's consent
 * message into the portal thread and send ONE nudge SMS with a link. Idempotent
 * — only acts on a report still in phase 'analysed'.
 */
export async function startRubyConversation(db: Admin, applicationId: string): Promise<void> {
  const { data: rep } = await db
    .from("ruby_reports")
    .select("phase, report")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!rep || rep.phase !== "analysed") return;

  const data = (rep.report as RubyReportData) ?? { summary: "", concerns: [], questions: [] };
  const app = await loadConvApp(db, applicationId);
  if (!app) return;

  // Nothing to ask → no conversation needed; mark complete.
  if (!data.questions?.length) {
    await db.from("ruby_reports").update({ phase: "complete" }).eq("application_id", applicationId).eq("phase", "analysed");
    return;
  }

  const name = firstName(app);
  const co = companyName(app);

  // Atomically CLAIM the analysed → conversing transition BEFORE sending anything.
  // If two runs race (e.g. the cron and a manual "Run Ruby" at the same moment),
  // only one wins this conditional update; the loser matches 0 rows and bails, so
  // the consent message + nudge SMS are sent exactly once.
  const { data: claimed } = await db
    .from("ruby_reports")
    .update({ phase: "conversing", consent: "asked", current_q: 0, sms_sent_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("phase", "analysed")
    .select("application_id")
    .maybeSingle();
  if (!claimed) return;

  await postRubyMessage(
    db,
    app,
    `Hi ${name}, it's Ruby from ${co}. I've a few quick questions about your application to help move things along. Is it OK to ask you a few now? Reply YES to start — or STOP to opt out at any time.`
  );

  // One nudge SMS to bring them to the portal (the conversation itself is free).
  const phone = app.applicants?.phone?.trim();
  if (phone) {
    const link = `${BASE_URL}/portal/conversations/${applicationId}`;
    const smsBody = `Hi ${name}, it's Ruby from ${co} — I've a few quick questions about your application. Tap to answer in your portal: ${link}`;
    // Ruby's nudge is covered by the per-applicant price — do NOT meter it as
    // company SMS.
    const r = await sendCompanySms(app.company_id, { to: phone, body: smsBody }, { meter: false });
    // Log the nudge SMS to the conversation so it shows in the staff SMS tab.
    await db.from("messages").insert({
      company_id: app.company_id,
      application_id: app.id,
      applicant_id: app.applicant_id,
      channel: "sms",
      direction: "outbound",
      from_ruby: true,
      body: smsBody,
      status: r.ok ? "sent" : "failed",
    });
  }

  await db
    .from("ruby_reports")
    .update({ phase: "conversing", consent: "asked", current_q: 0, sms_sent_at: new Date().toISOString() })
    .eq("application_id", applicationId);
}

const isOptOut = (t: string) => /\b(stop|unsubscribe|opt ?out)\b/i.test(t);
const isNegative = (t: string) => /^\s*(no|nope|not now|not really|no thanks|na|nah)\b/i.test(t);
const isAffirmative = (t: string) => /\b(yes|yeah|yep|yup|ok|okay|sure|go ahead|happy|fine|sounds good|please)\b/i.test(t);

async function askQuestion(db: Admin, app: ConvApp, data: RubyReportData, idx: number, lead = ""): Promise<void> {
  const q = data.questions[idx];
  if (!q) return;
  await postRubyMessage(db, app, `${lead}${q.question}`);
  await db.from("ruby_reports").update({ current_q: idx }).eq("application_id", app.id);
}

async function decline(db: Admin, app: ConvApp, ownerNote: string): Promise<void> {
  await postRubyMessage(db, app, "No problem at all — thanks anyway. The team will be in touch.");
  await db.from("ruby_reports").update({ phase: "declined", consent: "no" }).eq("application_id", app.id);
  await notifyJobOwner(db, {
    applicationId: app.id,
    type: "ruby_declined",
    prefKey: "applicant_message",
    title: `Ruby screening not completed: ${firstName(app)}`,
    body: ownerNote,
    link: "/pipeline",
    email: {
      subject: `Ruby screening not completed for ${firstName(app)}`,
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

async function finish(db: Admin, app: ConvApp, data: RubyReportData): Promise<void> {
  // Finalise the report with the Q&A FIRST (fast) so it ALWAYS completes on the
  // last answer, even if the synthesis AI call below is slow or the request
  // times out. The recommendation is a best-effort follow-up.
  await db
    .from("ruby_reports")
    .update({ phase: "complete", report: data, generated_at: new Date().toISOString() })
    .eq("application_id", app.id);

  await postRubyMessage(db, app, "Thank you — that's everything I needed. The team will review your application and be in touch.");

  await notifyJobOwner(db, {
    applicationId: app.id,
    type: "ruby_report",
    prefKey: "new_application",
    title: `Ruby screening complete: ${firstName(app)}`,
    body: data.recommendation?.slice(0, 160) || null,
    link: "/pipeline",
    email: {
      subject: `Ruby screening complete for ${firstName(app)}`,
      text: `Ruby has finished screening ${firstName(app)} and recorded their answers. Open the pipeline to read the report.`,
      ctaLabel: "Open pipeline",
      ctaUrl: `${BASE_URL}/pipeline`,
    },
  });

  // Recommendation + refreshed summary — best-effort; the report is already
  // complete with the concerns + Q&A if this is slow or fails.
  try {
    const cfg = await loadRubyRuntimeConfig(app.company_id);
    const synth = await synthesizeRubyReport(
      {
        jobTitle: app.jobs?.title ?? "Care role",
        jobDescription: app.jobs?.description ?? "",
        applicantName: [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ") || "the candidate",
        coverMessage: app.cover_message,
        answersText: answersText(app),
        cvBase64Pdf: null,
        referenceDocs: cfg.referenceDocs,
        focus: cfg.focus,
        instructions: cfg.instructions,
        requiredAttributes: cfg.requiredAttributes,
        desiredAttributes: cfg.desiredAttributes,
      },
      data.concerns,
      data.questions
    );
    if (synth.summary.length) data.summary = synth.summary;
    data.recommendation = synth.recommendation;
    // Ensure the applicant credit exists (idempotent — usually already claimed at
    // analysis). Ruby never trips the generic 10p AI meter.
    await recordRubyApplicant(app.company_id, app.id);
    await db.from("ruby_reports").update({ report: data }).eq("application_id", app.id);
  } catch {
    /* report already complete with the Q&A */
  }
}

/** Is Ruby mid-screening with this applicant (so their next reply is for Ruby)? */
export async function isRubyConversing(db: Admin, applicationId: string): Promise<boolean> {
  const { data } = await db.from("ruby_reports").select("phase").eq("application_id", applicationId).maybeSingle();
  return data?.phase === "conversing";
}

/**
 * Handle an applicant's portal reply as part of a Ruby screening conversation.
 * No-op unless that application has an active conversation (phase 'conversing').
 * Returns true if Ruby handled the reply (so the caller can skip the normal
 * "new message" owner notification).
 */
export async function handleRubyReply(db: Admin, applicationId: string, replyText: string): Promise<boolean> {
  const { data: rep } = await db
    .from("ruby_reports")
    .select("phase, consent, current_q, report")
    .eq("application_id", applicationId)
    .maybeSingle();
  if (!rep || rep.phase !== "conversing") return false;

  const app = await loadConvApp(db, applicationId);
  if (!app) return false;
  const data = (rep.report as RubyReportData) ?? { summary: "", concerns: [], questions: [] };
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
    await db.from("ruby_reports").update({ consent: "yes" }).eq("application_id", applicationId);
    await askQuestion(db, app, data, 0, "Great, thank you! ");
    return true;
  }

  // Answer step — record the answer to the current question, then advance.
  const idx = rep.current_q ?? 0;
  if (data.questions[idx]) data.questions[idx].answer = text.slice(0, 2000);
  const next = idx + 1;
  await db
    .from("ruby_reports")
    .update({ report: data, current_q: next, last_applicant_reply_at: new Date().toISOString() })
    .eq("application_id", applicationId);

  if (next < data.questions.length) {
    await askQuestion(db, app, data, next, "Thanks. ");
    return true;
  }

  // All current questions answered. If follow-ups are enabled, review the answers
  // once and ask any worth clarifying before finishing.
  const cfg = await loadRubyRuntimeConfig(app.company_id);
  if (cfg.followUps && !data.followUpsAdded && data.questions.some((q) => q.answer)) {
    try {
      const follow = await generateRubyFollowUps(
        {
          jobTitle: app.jobs?.title ?? "Care role",
          jobDescription: app.jobs?.description ?? "",
          applicantName: [app.applicants?.first_name, app.applicants?.last_name].filter(Boolean).join(" ") || "the candidate",
          coverMessage: app.cover_message,
          answersText: answersText(app),
          cvBase64Pdf: null,
          referenceDocs: cfg.referenceDocs,
          focus: cfg.focus,
          instructions: cfg.instructions,
          requiredAttributes: cfg.requiredAttributes,
          desiredAttributes: cfg.desiredAttributes,
        },
        data.questions
      );
      data.followUpsAdded = true;
      if (follow.length) {
        for (const f of follow) data.questions.push({ question: f.question, rationale: f.rationale, followUp: true });
        await db.from("ruby_reports").update({ report: data, current_q: next }).eq("application_id", applicationId);
        await askQuestion(db, app, data, next, "Thanks — just a couple of quick follow-ups. ");
        return true;
      }
      await db.from("ruby_reports").update({ report: data }).eq("application_id", applicationId);
    } catch {
      data.followUpsAdded = true; // never loop on an AI error — just finish
    }
  }
  await finish(db, app, data);
  return true;
}
