import Anthropic from "@anthropic-ai/sdk";
import type { InterviewInputs } from "@/lib/ai/generate-interview-questions";

/** One screening question, optionally with the applicant's answer (filled during
 *  the conversation). */
export type PoppyQ = { question: string; rationale: string; answer?: string };

/** The progressively-filled Poppy report stored on poppy_reports.report:
 *  - after analysis: summary + concerns + questions (no answers/recommendation)
 *  - after the conversation: questions gain answers
 *  - after synthesis: recommendation (and a refined summary) */
export type PoppyReportData = {
  summary: string;
  concerns: string[];
  recommendation?: string;
  questions: PoppyQ[];
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
${i.coverMessage ? `COVER MESSAGE:\n${i.coverMessage}\n` : ""}${i.answersText ? `APPLICATION & FORM RESPONSES:\n${i.answersText}\n` : ""}${i.cvBase64Pdf ? "The candidate's CV is attached as a PDF." : "No CV was provided."}`;

const FAIRNESS = "Be fair and non-discriminatory: never reference age, race, religion, sex, disability, pregnancy, marital status or other protected characteristics. Focus on ability to do the job.";

/**
 * ANALYSIS — review the application against the JD and produce the concerns plus
 * the screening questions Poppy will ASK the applicant (no verdict yet).
 */
export async function generatePoppyAnalysis(
  inputs: InterviewInputs
): Promise<{ summary: string; concerns: string[]; questions: { question: string; rationale: string }[] }> {
  const prompt = `You are Poppy, screening a candidate for a UK care-sector recruiter. Compare their application (and CV, if attached) against the job description.

${candidateBlock(inputs)}

Return ONLY a JSON object (no prose, no markdown):
{
  "summary": string,        // 1-2 sentences: who they are vs the role
  "concerns": string[],     // 0-5 short points: gaps/risks vs the JD to probe
  "questions": [ { "question": string, "rationale": string } ]  // the follow-ups to ASK the candidate
}

Rules:
- 3-6 questions — the most useful follow-ups to put to the candidate themselves (verify claimed experience, fill gaps vs the JD, clarify ambiguities). Phrase each as you would ask the candidate directly, warm and plain.
- "rationale" is one short internal note for the recruiter on why it's worth asking.
- ${FAIRNESS}`;

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
    summary: typeof o.summary === "string" ? o.summary.trim().slice(0, 800) : "",
    concerns: asStrings(o.concerns),
    questions: questions.slice(0, 6),
  };
}

/**
 * SYNTHESIS — given the concerns and the candidate's ANSWERS to the screening
 * questions, write the verdict (recommendation + refreshed summary).
 */
export async function synthesizePoppyReport(
  inputs: InterviewInputs,
  concerns: string[],
  qa: PoppyQ[]
): Promise<{ summary: string; recommendation: string }> {
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
  "summary": string,         // 2-3 sentences: candidate vs role, updated by their answers
  "recommendation": string   // one line: "Proceed to interview" / "Interview with caution" / "Likely not a fit" + why, informed by the answers
}

${FAIRNESS}`;

  const o = await askClaude(inputs, prompt);
  return {
    summary: typeof o.summary === "string" ? o.summary.trim().slice(0, 1000) : "",
    recommendation: typeof o.recommendation === "string" ? o.recommendation.trim().slice(0, 400) : "",
  };
}
