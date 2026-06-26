import Anthropic from "@anthropic-ai/sdk";

const FIELD_TYPES = [
  "short_text",
  "long_text",
  "number",
  "date",
  "date_range",
  "month",
  "time",
  "dropdown",
  "radio",
  "checkboxes",
  "yes_no",
  "rating",
  "country",
  "link",
  "email",
  "phone",
  "address",
  "file",
  "signature",
] as const;
type FieldType = (typeof FIELD_TYPES)[number];

export type ExtractedField = {
  label: string;
  field_type: FieldType;
  required: boolean;
  options: string[];
  help_text: string | null;
};

const PROMPT = `You are importing a printed/PDF job application form into a digital form builder.
Read the attached PDF and extract every question or field a candidate is expected to complete.

Return ONLY a JSON array (no prose, no markdown). Each item:
{ "label": string, "field_type": string, "required": boolean, "options": string[], "help_text": string | null }

Rules:
- field_type MUST be exactly one of: short_text, long_text, number, date, date_range, month, time, dropdown, radio, checkboxes, yes_no, rating, country, link, email, phone, address, file, signature.
- yes_no for yes/no questions. radio for "choose one" with set options. checkboxes for "select all that apply". dropdown for long option lists.
- date for a single date, date_range for a from–to period, month for month & year, time for a time of day, rating for star scores, country for a country, link for a URL, email/phone/address as named, signature for signatures.
- number for numeric-only, file for attachments/uploads, long_text for paragraph answers, short_text otherwise.
- "options" only for dropdown/radio/checkboxes; otherwise [].
- SKIP the basics already collected elsewhere: first name, last name, email, phone, postcode, CV upload, and right-to-work confirmation.
- Keep labels concise and faithful to the form.`;

/** Send a PDF to Claude and get a validated list of form fields. */
export async function extractFormFields(base64Pdf: string): Promise<ExtractedField[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("PDF import isn't configured yet (missing ANTHROPIC_API_KEY).");
  }

  // Keep retries low and time out before Vercel kills the function, so we
  // surface the real error instead of a generic "Connection error".
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 50_000 });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  let msg;
  try {
    msg = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64Pdf,
              },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
  } catch (err: unknown) {
    const e = err as {
      name?: string;
      status?: number;
      message?: string;
      error?: { error?: { message?: string } };
      cause?: { message?: string };
    };
    console.error("PDF import — Anthropic request failed:", err);
    const name = e?.name ?? "Error";
    const status = e?.status ? ` ${e.status}` : "";
    const detail = e?.error?.error?.message || e?.message || "unknown error";
    const cause = e?.cause?.message ? ` (cause: ${e.cause.message})` : "";
    throw new Error(`AI request failed: ${name}${status} — ${detail}${cause} [model: ${model}]`);
  }

  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("Couldn't read any questions from that PDF.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Couldn't understand the form in that PDF.");
  }
  if (!Array.isArray(parsed)) return [];

  const out: ExtractedField[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!label) continue;
    const ft = (typeof o.field_type === "string" ? o.field_type : "short_text") as FieldType;
    const options = Array.isArray(o.options)
      ? o.options.filter((x): x is string => typeof x === "string")
      : [];
    out.push({
      label: label.slice(0, 200),
      field_type: FIELD_TYPES.includes(ft) ? ft : "short_text",
      required: o.required === true,
      options,
      help_text:
        typeof o.help_text === "string" && o.help_text.trim()
          ? o.help_text.trim().slice(0, 300)
          : null,
    });
  }
  return out;
}
