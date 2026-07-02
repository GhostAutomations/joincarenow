import { createAdminClient } from "@/lib/supabase/admin";

export type PoppyConfig = {
  documentIds: string[];
  focus: string[];
  instructions: string;
  questionCount: number;
  /** If true, Poppy reviews the applicant's answers and asks follow-up questions
   *  before finishing (added to the report). */
  followUps: boolean;
  /** The attributes Poppy must assess every candidate against when comparing
   *  applicants. Defaults to the full standard list (all selected). */
  attributes: string[];
};

export const POPPY_FOCUS_OPTIONS = [
  "Safeguarding",
  "Availability & flexibility",
  "Experience & qualifications",
  "Compliance (RtW / DBS / registration)",
  "Communication",
];

/** The standard required attributes for UK care-sector screening. Poppy assesses
 *  every candidate against the selected ones. All are selected by default. */
export const POPPY_ATTRIBUTE_OPTIONS = [
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
  "Reliability & good attendance record",
  "Compassion & person-centred values",
  "Physical fitness for the role",
  "Professional registration (Social Care Wales / SSSC / NMC where applicable)",
  "First aid / basic life support",
  "Confidentiality & GDPR awareness",
  "Infection prevention & control awareness",
  "Willingness to complete required training",
];

const DEFAULT: PoppyConfig = {
  documentIds: [],
  focus: [],
  instructions: "",
  questionCount: 8,
  followUps: false,
  attributes: [...POPPY_ATTRIBUTE_OPTIONS],
};

/** Normalise a Poppy step question-count override (1-20, or null = use company default). */
export function normPoppyCount(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(20, Math.max(1, n)) : null;
}

/** Read a company's Poppy Settings config from companies.settings.poppy. */
export function readPoppyConfig(settings: unknown): PoppyConfig {
  const p = (settings as { poppy?: Partial<PoppyConfig> } | null)?.poppy ?? {};
  return {
    documentIds: Array.isArray(p.documentIds) ? p.documentIds.filter((x): x is string => typeof x === "string") : [],
    focus: Array.isArray(p.focus) ? p.focus.filter((x): x is string => typeof x === "string") : [],
    instructions: typeof p.instructions === "string" ? p.instructions : "",
    questionCount: typeof p.questionCount === "number" ? Math.min(20, Math.max(1, Math.round(p.questionCount))) : 8,
    followUps: p.followUps === true,
    // No saved `attributes` key = never configured → default to all selected.
    attributes: Array.isArray(p.attributes)
      ? p.attributes.filter((x): x is string => typeof x === "string")
      : [...POPPY_ATTRIBUTE_OPTIONS],
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
 * If a `step` is passed, its focus / instructions / question-count OVERRIDE the
 * company defaults (Settings = default; a workflow step can override).
 */
export async function loadPoppyRuntimeConfig(
  companyId: string,
  step?: PoppyStepOverride | null
): Promise<{ referenceDocs: { name: string; body: string }[]; focus: string[]; instructions: string; questionCount: number; followUps: boolean; attributes: string[] }> {
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
  return { referenceDocs, focus: cfg.focus, instructions: cfg.instructions, questionCount: cfg.questionCount, followUps: cfg.followUps, attributes: cfg.attributes };
}

export { DEFAULT as DEFAULT_POPPY_CONFIG };
