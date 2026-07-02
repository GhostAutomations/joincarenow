import { createAdminClient } from "@/lib/supabase/admin";

/** A group of attributes split into must-haves and nice-to-haves, plus any
 *  custom names the company added (so unassigned customs survive a reload). */
export type PoppyAttrGroup = { required: string[]; desired: string[]; custom: string[] };

export type PoppyConfig = {
  documentIds: string[];
  focus: string[];
  instructions: string;
  questionCount: number;
  /** If true, Poppy reviews the applicant's answers and asks follow-up questions
   *  before finishing (added to the report). */
  followUps: boolean;
  /** Master switch — when off, Poppy ignores attributes entirely. */
  attributesEnabled: boolean;
  /** Professional / compliance attributes, split required vs desired. */
  professional: PoppyAttrGroup;
  /** Personal / values attributes, split required vs desired. */
  personal: PoppyAttrGroup;
};

export const POPPY_FOCUS_OPTIONS = [
  "Safeguarding",
  "Availability & flexibility",
  "Experience & qualifications",
  "Compliance (RtW / DBS / registration)",
  "Communication",
];

/** Standard professional / compliance attributes for UK care-sector screening. */
export const POPPY_PROFESSIONAL_ATTRIBUTES = [
  "Right to Work in the UK",
  "Enhanced DBS check",
  "Two satisfactory references",
  "Relevant care experience",
  "Health & social care qualification (e.g. NVQ / QCF Diploma)",
  "Fully explained employment history (no unexplained gaps)",
  "Availability & flexibility (shifts, weekends, nights)",
  "Driving licence & access to a vehicle",
  "Safeguarding awareness",
  "Medication administration competence",
  "Moving & handling training",
  "Spoken & written English proficiency",
  "Professional registration (Social Care Wales / SSSC / NMC where applicable)",
  "First aid / basic life support",
  "Confidentiality & GDPR awareness",
  "Infection prevention & control awareness",
  "Willingness to complete required training",
];

/** Standard personal / values attributes. */
export const POPPY_PERSONAL_ATTRIBUTES = [
  "Compassion & empathy",
  "Patience",
  "Reliability & punctuality",
  "Good communication",
  "Team player",
  "Positive attitude",
  "Trustworthiness & integrity",
  "Adaptability",
  "Calm under pressure",
  "Respect & dignity for others",
  "Active listening",
  "Attention to detail",
  "Willingness to learn",
  "Emotional resilience",
  "Friendly & approachable",
];

const DEFAULT: PoppyConfig = {
  documentIds: [],
  focus: [],
  instructions: "",
  questionCount: 8,
  followUps: false,
  attributesEnabled: true,
  // Sensible starting point: professional criteria are required; personal
  // qualities are desirable. Companies can move any of them.
  professional: { required: [...POPPY_PROFESSIONAL_ATTRIBUTES], desired: [], custom: [] },
  personal: { required: [], desired: [...POPPY_PERSONAL_ATTRIBUTES], custom: [] },
};

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

function parseAttrGroup(raw: unknown, fallback: PoppyAttrGroup): PoppyAttrGroup {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const g = raw as Partial<PoppyAttrGroup>;
  return { required: strArr(g.required), desired: strArr(g.desired), custom: strArr(g.custom) };
}

/** Normalise a Poppy step question-count override (1-20, or null = use company default). */
export function normPoppyCount(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.max(1, n)) : null;
}

/** Read a company's Poppy Settings config from companies.settings.poppy. */
export function readPoppyConfig(settings: unknown): PoppyConfig {
  const p = (settings as { poppy?: Record<string, unknown> } | null)?.poppy ?? {};

  // Attributes: prefer the new structured shape; migrate the legacy flat
  // `attributes: string[]` (which was the professional list) to professional.required.
  const legacy = Array.isArray(p.attributes) ? strArr(p.attributes) : null;
  const professional =
    p.professional !== undefined
      ? parseAttrGroup(p.professional, DEFAULT.professional)
      : legacy
        ? { required: legacy, desired: [], custom: legacy.filter((a) => !POPPY_PROFESSIONAL_ATTRIBUTES.includes(a)) }
        : { ...DEFAULT.professional };
  const personal =
    p.personal !== undefined ? parseAttrGroup(p.personal, DEFAULT.personal) : { ...DEFAULT.personal };

  return {
    documentIds: strArr(p.documentIds),
    focus: strArr(p.focus),
    instructions: typeof p.instructions === "string" ? p.instructions : "",
    questionCount: typeof p.questionCount === "number" ? Math.min(20, Math.max(1, Math.round(p.questionCount))) : 8,
    followUps: p.followUps === true,
    attributesEnabled: typeof p.attributesEnabled === "boolean" ? p.attributesEnabled : true,
    professional,
    personal,
  };
}

/** Per-step overrides of the agent tuning (from a Poppy workflow step). Any set
 *  field replaces the company default; unset fields fall through. */
export type PoppyStepOverride = {
  poppy_focus?: string[] | null;
  poppy_instructions?: string | null;
  poppy_question_count?: number | null;
  /** Documents (policy/contract ids) to compare against — overrides the company
   *  default reference documents for this step. */
  poppy_document_ids?: string[] | null;
};

/**
 * Load a company's Poppy config plus the bodies of the selected reference
 * documents (policies + contracts). Job descriptions are NOT included here —
 * Poppy always uses the applicant's own role JD automatically.
 *
 * If a `step` is passed, its focus / instructions / question-count / documents
 * OVERRIDE the company defaults (Settings = default; a workflow step can override).
 */
export async function loadPoppyRuntimeConfig(
  companyId: string,
  step?: PoppyStepOverride | null
): Promise<{
  referenceDocs: { name: string; body: string }[];
  focus: string[];
  instructions: string;
  questionCount: number;
  followUps: boolean;
  requiredAttributes: string[];
  desiredAttributes: string[];
}> {
  const db = createAdminClient();
  const { data: co } = await db.from("companies").select("settings").eq("id", companyId).single();
  const cfg = readPoppyConfig(co?.settings);

  // Step overrides win over the company defaults where set.
  if (step) {
    if (Array.isArray(step.poppy_focus) && step.poppy_focus.length) cfg.focus = step.poppy_focus;
    if (typeof step.poppy_instructions === "string" && step.poppy_instructions.trim()) cfg.instructions = step.poppy_instructions;
    if (typeof step.poppy_question_count === "number" && step.poppy_question_count > 0) {
      cfg.questionCount = Math.min(20, Math.max(1, Math.round(step.poppy_question_count)));
    }
    if (Array.isArray(step.poppy_document_ids) && step.poppy_document_ids.length) cfg.documentIds = step.poppy_document_ids;
  }

  let referenceDocs: { name: string; body: string }[] = [];
  if (cfg.documentIds.length) {
    const [{ data: pol }, { data: con }] = await Promise.all([
      db.from("policy_documents").select("id, name, body").eq("company_id", companyId).in("id", cfg.documentIds),
      db.from("contract_templates").select("id, name, body").eq("company_id", companyId).in("id", cfg.documentIds),
    ]);
    referenceDocs = [...(pol ?? []), ...(con ?? [])].map((d) => ({
      name: (d.name as string) ?? "Document",
      body: (d.body as string) ?? "",
    }));
  }

  // Attributes only apply when the master switch is on.
  const requiredAttributes = cfg.attributesEnabled ? [...cfg.professional.required, ...cfg.personal.required] : [];
  const desiredAttributes = cfg.attributesEnabled ? [...cfg.professional.desired, ...cfg.personal.desired] : [];

  return {
    referenceDocs,
    focus: cfg.focus,
    instructions: cfg.instructions,
    questionCount: cfg.questionCount,
    followUps: cfg.followUps,
    requiredAttributes,
    desiredAttributes,
  };
}

export { DEFAULT as DEFAULT_POPPY_CONFIG };
