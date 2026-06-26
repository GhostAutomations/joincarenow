import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedField } from "@/lib/ai/extract-form";

const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "date",
  "dropdown",
  "radio",
  "checkboxes",
  "yes_no",
  "file",
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

const PROMPT = `You are designing a digital form for a UK care provider, inside a form builder.
Based on the user's description, generate the list of questions the form should ask.

Return ONLY a JSON array (no prose, no markdown). Each item:
{ "label": string, "field_type": string, "required": boolean, "options": string[], "help_text": string | null }

Rules:
- field_type MUST be exactly one of: short_text, long_text, number, date, dropdown, radio, checkboxes, yes_no, file.
- yes_no for yes/no questions. radio for "choose one" with a small set of options. checkboxes for "select all that apply". dropdown for longer option lists.
- date for dates, number for numeric-only, file for uploads/attachments/signatures, long_text for paragraph answers, short_text otherwise.
- "options" only for dropdown/radio/checkboxes (provide sensible options); otherwise [].
- Mark genuinely essential questions as required: true.
- Use clear, plain-English UK labels. Add short help_text only where it genuinely helps, else null.
- Produce a sensible, complete set (roughly 5–15 questions) for the described form. Don't pad.
- DO NOT include basics collected elsewhere: first name, last name, email, phone, postcode, CV upload, or right-to-work confirmation.
- UK English and UK care-sector terminology.`;

/** Generate a list of form fields from a plain-English brief, using Claude. */
export async function generateFormFields(brief: string, formName?: string): Promise<ExtractedField[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("AI form generation isn't configured yet (missing ANTHROPIC_API_KEY).");
  }
  const trimmed = (brief ?? "").trim();
  if (trimmed.length < 3) throw new Error("Describe the form you want first.");

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  const userText = `Form name: ${formName?.trim() || "(untitled)"}\n\nDescription of the form to build:\n${trimmed}`;

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 4096,
      system: PROMPT,
      messages: [{ role: "user", content: [{ type: "text", text: userText }] }],
    });
  } catch (err: unknown) {
    const e = err as { name?: string; status?: number; message?: string; error?: { error?: { message?: string } } };
    const name = e?.name ?? "Error";
    const status = e?.status ? ` ${e.status}` : "";
    const detail = e?.error?.error?.message || e?.message || "unknown error";
    throw new Error(`AI request failed: ${name}${status} — ${detail} [model: ${model}]`);
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("The AI didn't return any questions. Try rephrasing your description.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Couldn't understand the AI's response. Please try again.");
  }
  if (!Array.isArray(parsed)) return [];

  const out: ExtractedField[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const ft = (typeof o.field_type === "string" ? o.field_type : "short_text") as FieldType;
    const options = Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [];
    out.push({
      label: label.slice(0, 200),
      field_type: FIELD_TYPES.includes(ft) ? ft : "short_text",
      required: o.required === true,
      options,
      help_text: typeof o.help_text === "string" && o.help_text.trim() ? o.help_text.trim().slice(0, 300) : null,
    });
  }
  return out;
}
