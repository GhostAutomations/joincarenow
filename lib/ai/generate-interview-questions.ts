import Anthropic from "@anthropic-ai/sdk";

export type InterviewQuestion = { question: string; rationale: string };
export type InterviewQuestionGroup = { category: string; questions: InterviewQuestion[] };

export type InterviewInputs = {
  jobTitle: string;
  jobDescription: string; // the JD / advert body
  applicantName: string;
  coverMessage?: string | null;
  /** Application form answers as a readable string (or JSON), best-effort. */
  answersText?: string | null;
  /** The applicant's CV as a base64 PDF, if uploaded. */
  cvBase64Pdf?: string | null;
  /** Poppy Settings config (company): extra reference docs (policies etc.),
   *  focus areas, custom instructions, and how many questions to produce. */
  referenceDocs?: { name: string; body: string }[];
  focus?: string[];
  instructions?: string | null;
  questionCount?: number;
};

const ALLOWED_CATEGORIES = [
  "Experience & verification",
  "Gaps vs the role",
  "Role-specific scenarios",
  "Things to clarify",
];

const PROMPT = (i: InterviewInputs) => `You are helping a UK care-sector recruiter prepare to interview a candidate.
Compare the candidate's application (and CV, if attached) against the job description, then propose interview questions that help the recruiter make a good, fair decision.

ROLE: ${i.jobTitle}

JOB DESCRIPTION:
${i.jobDescription || "(no description provided)"}

CANDIDATE: ${i.applicantName}
${i.coverMessage ? `COVER MESSAGE:\n${i.coverMessage}\n` : ""}${i.answersText ? `APPLICATION & FORM RESPONSES (their submitted application form and any workflow forms):\n${i.answersText}\n` : ""}${i.cvBase64Pdf ? "The candidate's CV is also attached as a PDF." : "No CV was provided — base your questions on the application and forms above."}

Return ONLY a JSON array (no prose, no markdown). Each item is a group:
{ "category": string, "questions": [ { "question": string, "rationale": string } ] }

Rules:
- "category" MUST be exactly one of: ${ALLOWED_CATEGORIES.map((c) => `"${c}"`).join(", ")}.
- Produce 2-4 questions per category where you have material; omit a category if you have nothing genuine for it.
- "Experience & verification": probe and verify experience/qualifications the candidate claims that the role needs.
- "Gaps vs the role": where the application/CV does not clearly evidence something the JD asks for.
- "Role-specific scenarios": realistic situational questions for THIS care role.
- "Things to clarify": ambiguities, unexplained gaps in dates, or points worth confirming.
- "rationale" is one short sentence telling the recruiter why to ask it (tie it to the JD or the candidate's specifics).
- Be fair and non-discriminatory: never base questions on age, race, religion, sex, disability, pregnancy, marital status or other protected characteristics. Focus on ability to do the job.
- Keep questions concise and directly usable in an interview.`;

/** Generate grouped, validated interview questions from the JD + application + CV. */
export async function generateInterviewQuestions(
  inputs: InterviewInputs
): Promise<InterviewQuestionGroup[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Poppy isn't configured yet (missing ANTHROPIC_API_KEY).");

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

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content }],
    });
  } catch (err: unknown) {
    const e = err as { name?: string; status?: number; message?: string; error?: { error?: { message?: string } } };
    console.error("Poppy interview questions — Anthropic request failed:", err);
    const detail = e?.error?.error?.message || e?.message || "unknown error";
    throw new Error(`AI request failed: ${e?.name ?? "Error"}${e?.status ? ` ${e.status}` : ""} — ${detail}`);
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Poppy couldn't produce questions from this application.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Poppy returned an unexpected response. Please try again.");
  }
  if (!Array.isArray(parsed)) return [];

  const out: InterviewQuestionGroup[] = [];
  for (const g of parsed) {
    if (!g || typeof g !== "object") continue;
    const grp = g as Record<string, unknown>;
    const category = typeof grp.category === "string" ? grp.category.trim() : "";
    if (!category) continue;
    const qsRaw = Array.isArray(grp.questions) ? grp.questions : [];
    const questions: InterviewQuestion[] = [];
    for (const q of qsRaw) {
      if (!q || typeof q !== "object") continue;
      const qo = q as Record<string, unknown>;
      const question = typeof qo.question === "string" ? qo.question.trim() : "";
      if (!question) continue;
      questions.push({
        question: question.slice(0, 500),
        rationale: typeof qo.rationale === "string" ? qo.rationale.trim().slice(0, 300) : "",
      });
    }
    if (questions.length) out.push({ category: category.slice(0, 80), questions });
  }
  return out;
}
