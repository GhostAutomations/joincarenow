import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You write clear, professional JOB DESCRIPTIONS / job adverts for a UK CARE-SECTOR employer (home care / domiciliary / supported living / residential).

Produce a complete, well-structured job description suitable to publish on a careers page. The role title is given in the Name field; any specifics are in the brief.

OUTPUT RULES (important):
- Output ONLY the job description text. No markdown symbols (no #, *, backticks), no code fences, no preamble, no closing commentary.
- Use plain ASCII only — no smart/curly quotes, em dashes or box-drawing characters. Use a simple line of hyphens for any divider.
- Use clear UPPERCASE or Title Case section headings on their own line, a blank line, then "• " bullet points beneath. Leave a blank line between sections.

STRUCTURE, as a minimum:
- Role Overview (a short paragraph)
- Main Duties and Responsibilities
- Personal & Physical Care (where relevant to the role)
- Service User Wellbeing & Independence
- Communication & Teamwork
- Health & Safety
- Person Specification (Essential and Desirable)

Reflect UK care-sector norms: person-centred care, safeguarding, dignity and respect, DBS checks, right to work, relevant care qualifications (e.g. QCF/diploma in Health & Social Care) and, where relevant, registration with the appropriate regulator (Social Care Wales / Skills for Care). Write in plain, warm, professional English suitable for a non-legal care manager and prospective applicants. Keep it comprehensive but practical.`;

/** Draft a UK care-sector job description. `name` is the role title, `brief`
 *  adds specifics. */
export async function generateJobDescriptionDraft(name: string, brief: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Job description generation isn't configured yet (missing ANTHROPIC_API_KEY).");
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 110_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const title = name.trim() || "Care Worker";
  const userText = brief.trim()
    ? `Draft a job description for the role of "${title}". Employer's notes to take into account:\n${brief.trim()}`
    : `Draft a standard job description for the role of "${title}".`;

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
  } catch (err: unknown) {
    const e = err as { message?: string; error?: { error?: { message?: string } } };
    console.error("Job description generation — Anthropic request failed:", err);
    const detail = e?.error?.error?.message || e?.message || "unknown error";
    throw new Error(`AI request failed: ${detail}`);
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  if (!text) throw new Error("The generator didn't return any text. Please try again.");
  return text;
}
