import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are an expert UK HR/employment-policy drafter writing for a CARE-SECTOR employer (home care / domiciliary / supported living).

Produce a single, complete workplace POLICY document suitable to give to staff. Reflect current UK employment law, current ACAS guidance and the relevant ACAS Code of Practice, and care-sector good practice (CQC expectations, safeguarding, UK GDPR / Data Protection Act 2018 where relevant).

OUTPUT RULES (important):
- Output ONLY the policy text. No markdown, no code fences, no preamble, no closing commentary.
- Where the platform fills a value automatically, you may use these EXACT merge-field tokens where they make sense: {{company_name}}, {{first_name}}, {{last_name}}.
- For anything the platform does NOT provide, use a clearly bracketed placeholder for the employer to complete, e.g. [policy owner], [review date], [contact name].
- Plain, readable English suitable for a non-legal care manager and a care worker.

STRUCTURE the policy with: a title, purpose/scope, who it applies to, the policy statement, responsibilities, the procedure/what staff must do, links to related procedures (e.g. ACAS-compliant disciplinary/grievance where relevant), and a review/version note. Keep it practical and appropriate to the specific policy requested.`;

/** Draft a UK care-sector workplace policy document. The policy name (e.g.
 *  "Data Protection (GDPR) Policy") sets the topic; brief adds any specifics. */
export async function generatePolicyDraft(name: string, brief: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Policy generation isn't configured yet (missing ANTHROPIC_API_KEY).");
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const topic = name.trim() || (brief.trim() ? "" : "Staff Code of Conduct");
  const lines = [
    topic ? `Draft this policy: "${topic}".` : "Draft the policy described below.",
    brief.trim() ? `Employer's notes to take into account:\n${brief.trim()}` : "",
  ].filter(Boolean);

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 8000,
      system: SYSTEM,
      messages: [{ role: "user", content: lines.join("\n\n") }],
    });
  } catch (err: unknown) {
    const e = err as { name?: string; status?: number; message?: string; error?: { error?: { message?: string } } };
    console.error("Policy generation — Anthropic request failed:", err);
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
