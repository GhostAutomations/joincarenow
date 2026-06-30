import Anthropic from "@anthropic-ai/sdk";
import type { InterviewInputs, InterviewQuestionGroup } from "@/lib/ai/generate-interview-questions";

export type PoppyReport = {
  summary: string;
  strengths: string[];
  concerns: string[];
  recommendation: string;
  questions: InterviewQuestionGroup[];
};

const PROMPT = (i: InterviewInputs) => `You are Poppy, a screening assistant for a UK care-sector recruiter.
Compare the candidate's application (and CV, if attached) against the job description and write a concise screening report to help the recruiter decide whether to interview.

ROLE: ${i.jobTitle}

JOB DESCRIPTION:
${i.jobDescription || "(no description provided)"}

CANDIDATE: ${i.applicantName}
${i.coverMessage ? `COVER MESSAGE:\n${i.coverMessage}\n` : ""}${i.answersText ? `APPLICATION & FORM RESPONSES:\n${i.answersText}\n` : ""}${i.cvBase64Pdf ? "The candidate's CV is attached as a PDF." : "No CV was provided — use the application and forms above."}

Return ONLY a JSON object (no prose, no markdown):
{
  "summary": string,            // 2-3 sentences: who they are vs the role
  "strengths": string[],        // 2-5 short points evidenced by the application/CV
  "concerns": string[],         // 0-5 short points: gaps or risks vs the JD
  "recommendation": string,     // one line, e.g. "Proceed to interview" / "Interview with caution" / "Likely not a fit" + why
  "questions": [ { "category": string, "questions": [ { "question": string, "rationale": string } ] } ]
}

Rules:
- "questions" groups use categories exactly from: "Experience & verification", "Gaps vs the role", "Role-specific scenarios", "Things to clarify". 2-4 per category where you have material; omit empty categories.
- Be fair and non-discriminatory: never reference age, race, religion, sex, disability, pregnancy, marital status or other protected characteristics. Focus on ability to do the job.
- Keep everything concise and directly useful.`;

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, 8) : [];

function parseQuestions(v: unknown): InterviewQuestionGroup[] {
  if (!Array.isArray(v)) return [];
  const out: InterviewQuestionGroup[] = [];
  for (const g of v) {
    if (!g || typeof g !== "object") continue;
    const grp = g as Record<string, unknown>;
    const category = typeof grp.category === "string" ? grp.category.trim() : "";
    if (!category) continue;
    const qs: { question: string; rationale: string }[] = [];
    for (const q of Array.isArray(grp.questions) ? grp.questions : []) {
      if (!q || typeof q !== "object") continue;
      const qo = q as Record<string, unknown>;
      const question = typeof qo.question === "string" ? qo.question.trim() : "";
      if (!question) continue;
      qs.push({
        question: question.slice(0, 500),
        rationale: typeof qo.rationale === "string" ? qo.rationale.trim().slice(0, 300) : "",
      });
    }
    if (qs.length) out.push({ category: category.slice(0, 80), questions: qs });
  }
  return out;
}

/** Generate a structured Poppy screening report from the JD + application + CV. */
export async function generatePoppyReport(inputs: InterviewInputs): Promise<PoppyReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Poppy isn't configured (missing ANTHROPIC_API_KEY).");

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const content: Anthropic.MessageParam["content"] = [];
  if (inputs.cvBase64Pdf) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: inputs.cvBase64Pdf },
    });
  }
  content.push({ type: "text", text: PROMPT(inputs) });

  const msg = await client.messages.create({ model, max_tokens: 4096, messages: [{ role: "user", content }] });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) throw new Error("Poppy couldn't produce a report.");
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Poppy returned an unexpected response.");
  }

  return {
    summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 1200) : "",
    strengths: asStrings(parsed.strengths),
    concerns: asStrings(parsed.concerns),
    recommendation: typeof parsed.recommendation === "string" ? parsed.recommendation.trim().slice(0, 400) : "",
    questions: parseQuestions(parsed.questions),
  };
}
