import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are an expert UK employment-law drafter producing contracts for a CARE-SECTOR employer (home care / domiciliary / supported living).

Produce a complete, professional employment contract that doubles as the written statement of particulars required by section 1 of the Employment Rights Act 1996 (as amended from 6 April 2020, so it is given on day one). Reflect current UK employment law and current ACAS guidance and the ACAS Code of Practice on Disciplinary and Grievance Procedures.

OUTPUT RULES (important):
- Output ONLY the contract text. No markdown, no code fences, no preamble, no closing commentary.
- Where a value will be filled in automatically by the platform, use these EXACT merge-field tokens: {{company_name}}, {{first_name}}, {{last_name}}, {{job_title}}, {{role}}, {{pay}}, {{hours}}, {{start_date}}, {{conditions}}.
- For details the platform does NOT provide, use a clearly bracketed placeholder for the employer to complete, e.g. [place of work], [notice period], [pension scheme name], [holiday year start date].
- Use plain, readable English suitable for a non-legal care manager and a care worker.
- Use plain ASCII only — no box-drawing lines, smart/curly quotes, em dashes or other special symbols. For section dividers use a simple line of hyphens (e.g. "----------") or just a numbered heading; never characters like "─────".

COVER, AS A MINIMUM, the statutory particulars and care-sector essentials:
- Parties and employment start date / continuity of employment
- Job title ({{job_title}} / {{role}}) and a short duties summary
- Probationary period
- Place(s) of work and any travel / mobility (relevant to domiciliary care)
- Hours and days of work, including variability, and any overtime
- Pay rate ({{pay}}), pay frequency and method; note National Minimum/Living Wage compliance
- Holiday entitlement and holiday pay (statutory minimum 5.6 weeks)
- Sickness absence and Statutory Sick Pay
- Pension auto-enrolment
- Notice periods (both parties), reflecting statutory minimums
- Disciplinary and grievance procedures, expressly following the ACAS Code of Practice
- Confidentiality and data protection (UK GDPR / Data Protection Act 2018), and service-user confidentiality
- Pre-employment and ongoing conditions for care work: satisfactory DBS check, right to work in the UK, references, and required training/registration ({{conditions}} where relevant)
- Health & safety, safeguarding and duty of care to service users
- Termination
- Governing law (law of England and Wales unless otherwise indicated)

Keep it comprehensive but practical. Do not include placeholders for a signature block — signing is handled electronically by the platform.`;

/** Draft a UK care-sector employment contract template (with merge fields). */
export async function generateContractDraft(brief: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Contract generation isn't configured yet (missing ANTHROPIC_API_KEY).");
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 110_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const userText = brief.trim()
    ? `Draft the contract. Employer's notes to take into account:\n${brief.trim()}`
    : "Draft a standard care-sector employment contract template.";

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM,
      messages: [{ role: "user", content: userText }],
    });
  } catch (err: unknown) {
    const e = err as { name?: string; status?: number; message?: string; error?: { error?: { message?: string } } };
    console.error("Contract generation — Anthropic request failed:", err);
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
