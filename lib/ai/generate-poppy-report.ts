import Anthropic from "@anthropic-ai/sdk";
import type { InterviewInputs } from "@/lib/ai/generate-interview-questions";

/** One screening question, optionally with the applicant's answer (filled during
 *  the conversation). `followUp` marks a question Poppy asked after reviewing the
 *  applicant's earlier answers. */
export type PoppyQ = { question: string; rationale: string; answer?: string; followUp?: boolean };

/** The progressively-filled Poppy report stored on poppy_reports.report:
 *  - after analysis: summary + concerns + questions (no answers/recommendation)
 *  - after the conversation: questions gain answers
 *  - after synthesis: recommendation (and a refined summary) */
export type PoppyReportData = {
  summary: string[]; // key findings as bullet points
  concerns: string[];
  recommendation?: string;
  questions: PoppyQ[];
  /** Set once Poppy has generated its one round of follow-up questions. */
  followUpsAdded?: boolean;
};

const MODEL = () => process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Poppy isn't configured (missing ANTHROPIC_API_KEY).");
  return new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
}

async function askClaude(inputs: InterviewInputs, prompt: string): Promise<Record<string, unknown>> {
  const content: Anthropic.MessageParam["content"] = [];
  if (inputs.cvBase64Pdf) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: inputs.cvBase64Pdf } });
  }
  content.push({ type: "text", text: prompt });

  const msg = await client().messages.create({ model: MODEL(), max_tokens: 4096, messages: [{ role: "user", content }] });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Poppy returned an unexpected response.");
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("Poppy returned an unexpected response.");
  }
}

const asStrings = (v: unknown, max = 6): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, max) : [];

const candidateBlock = (i: InterviewInputs) =>
  `ROLE: ${i.jobTitle}

JOB DESCRIPTION:
${i.jobDescription || "(no description provided)"}

CANDIDATE: ${i.applicantName}
${i.coverMessage ? `COVER MESSAGE:\n${i.coverMessage}\n` : ""}${i.answersText ? `APPLICATION & FORM RESPONSES:\n${i.answersText}\n` : ""}${i.cvBase64Pdf ? "The candidate's CV is attached as a PDF." : "No CV was provided."}
${i.referenceDocs?.length ? `\nCOMPANY REFERENCE DOCUMENTS (judge the candidate against these where relevant):\n${i.referenceDocs.map((d) => `--- ${d.name} ---\n${(d.body || "").slice(0, 4000)}`).join("\n\n")}\n` : ""}${i.attributes?.length ? `\nREQUIRED ATTRIBUTES (assess the candidate against every one of these; treat any that is missing, unmet or unclear as a gap worth probing):\n${i.attributes.map((a) => `- ${a}`).join("\n")}\n` : ""}${i.focus?.length ? `\nFOCUS PARTICULARLY ON: ${i.focus.join(", ")}.` : ""}${i.instructions ? `\nCOMPANY INSTRUCTIONS (follow these): ${i.instructions}` : ""}`;

const FAIRNESS = "Be fair and non-discriminatory: never reference age, race, religion, sex, disability, pregnancy, marital status or other protected characteristics. Focus on ability to do the job.";

/**
 * ANALYSIS — review the application against the JD and produce the concerns plus
 * the screening questions Poppy will ASK the applicant (no verdict yet).
 */
export async function generatePoppyAnalysis(
  inputs: InterviewInputs
): Promise<{ summary: string[]; concerns: string[]; questions: { question: string; rationale: string }[] }> {
  const prompt = `You are Poppy, screening a candidate for a UK care-sector recruiter. Compare their application (and CV, if attached) against the job description.

${candidateBlock(inputs)}

Return ONLY a JSON object (no prose, no markdown):
{
  "summary": string[],      // 1-3 SHORT, SHARP bullet points — a few words each (max ~10), not sentences: who they are vs the role
  "concerns": string[],     // 0-5 short points: gaps/risks vs the JD to probe
  "questions": [ { "question": string, "rationale": string } ]  // the follow-ups to ASK the candidate
}

Rules:
- Produce EXACTLY ${Math.min(20, Math.max(1, Math.round(inputs.questionCount || 8)))} questions. PRIORITISE what most affects the hiring decision, in this order: (1) unexplained GAPS or inconsistent/overlapping DATES in their employment history — ask about the specific period directly, naming the dates; (2) required information that is missing, vague or contradictory; (3) claimed experience or qualifications that need verifying against the job description; (4) any safeguarding or compliance concern (Right to Work, DBS, registration).
- Go DEEP on what matters rather than spreading one shallow question across every topic — it is better to properly probe a real gap than to ask a generic question about something already clear.
- Phrase each as you would ask the candidate directly, warm and plain.
- "rationale" is one short internal note for the recruiter on why it's worth asking.
- ${FAIRNESS}`;

  const QCOUNT = Math.min(20, Math.max(1, Math.round(inputs.questionCount || 8)));
  const o = await askClaude(inputs, prompt);
  const questions: { question: string; rationale: string }[] = [];
  for (const q of Array.isArray(o.questions) ? o.questions : []) {
    if (!q || typeof q !== "object") continue;
    const qo = q as Record<string, unknown>;
    const question = typeof qo.question === "string" ? qo.question.trim() : "";
    if (!question) continue;
    questions.push({
      question: question.slice(0, 400),
      rationale: typeof qo.rationale === "string" ? qo.rationale.trim().slice(0, 300) : "",
    });
  }
  return {
    summary: asStrings(o.summary, 4),
    concerns: asStrings(o.concerns),
    questions: questions.slice(0, QCOUNT),
  };
}

/**
 * FOLLOW-UPS — after the applicant has answered the screening questions, review
 * their answers and produce up to `max` follow-up questions worth clarifying
 * (vague, concerning or incomplete answers). Returns [] if nothing needs probing.
 */
export async function generatePoppyFollowUps(
  inputs: InterviewInputs,
  qa: PoppyQ[],
  max = 5
): Promise<{ question: string; rationale: string }[]> {
  const answered = qa.filter((q) => q.answer && q.answer.trim());
  if (!answered.length) return [];
  const transcript = answered.map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer}`).join("\n\n");

  const prompt = `You are Poppy, screening a candidate for a UK care-sector recruiter. You already asked screening questions; the candidate's answers are below. Review them and decide whether any FOLLOW-UP questions are worth asking to clarify a vague, incomplete or concerning answer.

${candidateBlock(inputs)}

ANSWERS SO FAR:
${transcript}

Return ONLY a JSON object (no prose, no markdown):
{
  "questions": [ { "question": string, "rationale": string } ]
}

Rules:
- Include a follow-up where an answer is vague, evasive, incomplete, or leaves a gap, inconsistency or unexplained period still unaccounted for. Keep pushing on an unexplained employment gap or a contradiction until it is actually explained — don't accept a non-answer. Return an empty array ONLY if the answers are genuinely clear and complete.
- At most ${max} follow-ups. Phrase each warmly and plainly, as you'd ask the candidate directly.
- "rationale" is one short internal note for the recruiter on why it's worth asking.
- ${FAIRNESS}`;

  const o = await askClaude({ ...inputs, cvBase64Pdf: null }, prompt);
  const out: { question: string; rationale: string }[] = [];
  for (const q of Array.isArray(o.questions) ? o.questions : []) {
    if (!q || typeof q !== "object") continue;
    const qo = q as Record<string, unknown>;
    const question = typeof qo.question === "string" ? qo.question.trim() : "";
    if (!question) continue;
    out.push({
      question: question.slice(0, 400),
      rationale: typeof qo.rationale === "string" ? qo.rationale.trim().slice(0, 300) : "",
    });
  }
  return out.slice(0, max);
}

/**
 * SYNTHESIS — given the concerns and the candidate's ANSWERS to the screening
 * questions, write the verdict (recommendation + refreshed summary).
 */
export async function synthesizePoppyReport(
  inputs: InterviewInputs,
  concerns: string[],
  qa: PoppyQ[]
): Promise<{ summary: string[]; recommendation: string }> {
  const transcript = qa
    .map((q, i) => `Q${i + 1}: ${q.question}\nA${i + 1}: ${q.answer?.trim() || "(no answer)"}`)
    .join("\n\n");

  const prompt = `You are Poppy. You already reviewed this candidate and asked them screening questions; their answers are below. Write a short verdict for the recruiter, taking the answers into account.

${candidateBlock(inputs)}

INITIAL CONCERNS:
${concerns.length ? concerns.map((c) => `- ${c}`).join("\n") : "(none)"}

SCREENING Q&A:
${transcript || "(no answers)"}

Return ONLY a JSON object:
{
  "summary": string[],       // 3-6 SHORT, SHARP bullet points — a few words each (max ~10), NOT full sentences: the key findings on the candidate vs the role
  "recommendation": string   // one line: "Proceed to interview" / "Interview with caution" / "Likely not a fit" + why, informed by the answers
}

Rules:
- Each summary bullet is a punchy phrase, not a sentence (e.g. "3 years care experience", "Refuses to transport service users", "Weak safeguarding judgement"). No trailing full stops.
- The detail lives in the Q&A and the recommendation — the summary is just the headlines.
- ${FAIRNESS}`;

  const o = await askClaude(inputs, prompt);
  return {
    summary: asStrings(o.summary, 8),
    recommendation: typeof o.recommendation === "string" ? o.recommendation.trim().slice(0, 400) : "",
  };
}
