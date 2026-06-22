import Anthropic from "@anthropic-ai/sdk";

const SYSTEM = `You are an SDR (sales development rep) for Join Care Now, a UK care-sector SaaS platform (recruitment, onboarding and workforce management for home care / domiciliary / residential / supported living providers). You write short, warm, professional B2B messages to UK care providers (registered managers, owner-operators, HR leads).

RULES:
- Plain ASCII only. No markdown, no emojis, no hype.
- Email: 60-120 words. SMS: under 300 characters.
- Friendly and human; lead with their world (staffing crisis, turnover, time spent on hiring/compliance admin), not features.
- The goal of every message is a small next step: a quick call or a short demo.
- NEVER state prices, contract terms, discounts, or compliance guarantees. If they ask, offer to discuss on a call.
- EMAIL output format EXACTLY: first line "Subject: <subject>", then a blank line, then the body.
- SMS output: just the message body, no subject line.
- Use the contact's first name if provided. Sign emails off as "The Join Care Now team".`;

export type DraftInput = {
  channel: "email" | "sms";
  companyName: string;
  contactName?: string | null;
  stage?: string | null;
  setting?: string | null;
  region?: string | null;
  history: { direction: string | null; channel?: string | null; subject?: string | null; body?: string | null }[];
  lastInbound?: string | null;
};

export async function draftProspectMessage(input: DraftInput): Promise<{ subject: string | null; body: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("AI drafting isn't configured (missing ANTHROPIC_API_KEY).");
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const historyText = input.history
    .slice(0, 10)
    .map((h) => `${h.direction === "inbound" ? "THEM" : "US"}${h.channel ? ` (${h.channel})` : ""}: ${h.subject ? h.subject + " — " : ""}${(h.body || "").slice(0, 400)}`)
    .join("\n");

  const task = input.lastInbound
    ? `They just replied:\n"""${input.lastInbound.slice(0, 1500)}"""\nWrite a helpful ${input.channel} reply that answers them and moves toward a quick call/demo.`
    : `Write the next ${input.channel} follow-up to gently re-engage them.`;

  const user = `Prospect company: ${input.companyName}${input.contactName ? ` — contact ${input.contactName}` : ""}.
Care setting: ${input.setting ?? "unknown"}. Region: ${input.region ?? "unknown"}. Pipeline stage: ${input.stage ?? "new"}.
Conversation so far (oldest first):
${historyText || "(no prior messages)"}

${task}`;

  const msg = await client.messages.create({
    model,
    max_tokens: 700,
    system: SYSTEM,
    messages: [{ role: "user", content: user }],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((b) => (b as any).text as string)
    .join("")
    .trim();

  if (input.channel === "email") {
    const m = text.match(/^subject:\s*(.+?)\n+([\s\S]+)$/i);
    if (m) return { subject: m[1].trim(), body: m[2].trim() };
    return { subject: "Following up", body: text };
  }
  return { subject: null, body: text };
}

/**
 * Classify whether a single inbound message means the prospect is booking,
 * scheduling, accepting or confirming a demo/call. Returns false on any error
 * so it never blocks the reply flow.
 */
export async function classifyDemoIntent(lastInbound: string): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !lastInbound.trim()) return false;
  try {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    const msg = await client.messages.create({
      model,
      max_tokens: 5,
      system:
        "You classify ONE inbound B2B message from a sales prospect. Reply with exactly YES or NO. Answer YES only if the sender is agreeing to, requesting, proposing a time for, accepting, or confirming a demo or a call/meeting to see the product (e.g. 'let's book a demo', 'happy to have a call', 'how about Tuesday at 2', 'yes that time works'). Otherwise answer NO.",
      messages: [{ role: "user", content: lastInbound.slice(0, 1500) }],
    });
    const text = msg.content
      .filter((b) => b.type === "text")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b) => (b as any).text as string)
      .join("")
      .trim()
      .toUpperCase();
    return text.startsWith("Y");
  } catch {
    return false;
  }
}
