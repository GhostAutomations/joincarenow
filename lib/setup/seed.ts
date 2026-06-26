// ============================================================
// JOIN CARE NOW — Company starter-pack seed engine
// Applies STARTER_* content (forms, onboarding workflow, message templates,
// sample job + communication defaults) to a company so it's turnkey on day one.
//
// Idempotent: gated on companies.settings.starter_pack_version. Safe to call
// from provisioning (service-role, no user session) AND from a founder action.
// Uses the service-role admin client and bypasses RLS — callers MUST do their
// own authorisation first (the founder action checks requirePlatformAdmin; the
// provision path is already trusted server-side).
// ============================================================

import { createAdminClient } from "@/lib/supabase/admin";
import {
  STARTER_PACK_VERSION,
  STARTER_FORMS,
  STARTER_ONBOARDING,
  STARTER_TEMPLATES,
  DEFAULT_ROLES,
  STARTER_CAREERS,
  STARTER_REMINDERS,
  STARTER_BRAND_PRIMARY,
} from "@/lib/setup/starter-pack";

export type SeedResult = {
  ok: boolean;
  alreadySeeded?: boolean;
  error?: string;
  created?: {
    forms: number;
    fields: number;
    onboardingTasks: number;
    templates: number;
    roles: number;
  };
};

type CompanySettings = {
  starter_pack_version?: number;
  starter_seeded_at?: string;
  careers?: { intro?: string; benefits?: string[] };
  reminders?: Record<string, unknown>;
  brand?: { primary?: string; secondary?: string; accent?: string; logo_url?: string | null };
  [key: string]: unknown;
};

/**
 * Seed the full starter pack into a company.
 * @param force re-apply even if already seeded (rarely needed; guards against
 *              duplicates by skipping forms/jobs/templates that already exist).
 */
export async function seedCompanyStarter(
  companyId: string,
  opts: { force?: boolean } = {}
): Promise<SeedResult> {
  if (!companyId) return { ok: false, error: "Missing company id." };
  const db = createAdminClient();

  const { data: company, error: companyErr } = await db
    .from("companies")
    .select("id, settings")
    .eq("id", companyId)
    .single();
  if (companyErr || !company) return { ok: false, error: "Company not found." };

  const settings = (company.settings ?? {}) as CompanySettings;
  if (!opts.force && (settings.starter_pack_version ?? 0) >= STARTER_PACK_VERSION) {
    return { ok: true, alreadySeeded: true };
  }

  const created = { forms: 0, fields: 0, onboardingTasks: 0, templates: 0, roles: 0 };

  // ---- 0. Default roles -----------------------------------
  // Idempotent via the unique (company_id, name) constraint — ignore conflicts.
  // position keeps them in the intended order (not alphabetical).
  const roleRows = DEFAULT_ROLES.map((name, i) => ({ company_id: companyId, name, position: i }));
  const { error: rolesErr } = await db
    .from("roles")
    .upsert(roleRows, { onConflict: "company_id,name", ignoreDuplicates: true });
  if (rolesErr) return { ok: false, error: `Roles: ${rolesErr.message}` };
  created.roles = roleRows.length;

  // ---- 1. Forms + fields ----------------------------------
  // formKey -> new form id, so onboarding tasks + the sample job can wire up.
  const formIdByKey = new Map<string, string>();

  // Names already present (so a forced re-run doesn't duplicate forms).
  const { data: existingForms } = await db
    .from("forms")
    .select("id, name")
    .eq("company_id", companyId)
    .eq("is_store", false);
  const existingFormByName = new Map(
    (existingForms ?? []).map((f) => [String(f.name), String(f.id)])
  );

  for (const form of STARTER_FORMS) {
    const already = existingFormByName.get(form.name);
    if (already) {
      formIdByKey.set(form.key, already);
      continue;
    }
    const { data: inserted, error: formErr } = await db
      .from("forms")
      .insert({
        company_id: companyId,
        name: form.name,
        purpose: form.purpose,
        category: form.category,
        description: form.description,
        is_store: false,
        created_by: null,
      })
      .select("id")
      .single();
    if (formErr || !inserted) return { ok: false, error: `Form "${form.name}": ${formErr?.message ?? "insert failed"}` };
    const formId = String(inserted.id);
    formIdByKey.set(form.key, formId);
    created.forms++;

    const fieldRows = form.fields.map((f, i) => ({
      form_id: formId,
      label: f.label,
      field_type: f.field_type,
      required: f.required ?? false,
      options: f.options ?? [],
      help_text: f.help_text ?? null,
      position: i,
    }));
    const { error: fieldErr } = await db.from("form_fields").insert(fieldRows);
    if (fieldErr) return { ok: false, error: `Fields for "${form.name}": ${fieldErr.message}` };
    created.fields += fieldRows.length;
  }

  // ---- 2. Onboarding workflow -----------------------------
  const { count: onbCount } = await db
    .from("onboarding_templates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (!onbCount) {
    const onbRows = STARTER_ONBOARDING.map((t, i) => ({
      company_id: companyId,
      title: t.title,
      task_type: t.task_type,
      form_id: t.formKey ? formIdByKey.get(t.formKey) ?? null : null,
      body: t.body ?? null,
      required: t.required ?? true,
      due_days: t.due_days ?? null,
      position: i,
    }));
    const { error: onbErr } = await db.from("onboarding_templates").insert(onbRows);
    if (onbErr) return { ok: false, error: `Onboarding: ${onbErr.message}` };
    created.onboardingTasks = onbRows.length;
  }

  // ---- 3. Message templates -------------------------------
  const { count: tplCount } = await db
    .from("message_templates")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId);
  if (!tplCount) {
    const tplRows = STARTER_TEMPLATES.map((t) => ({
      company_id: companyId,
      channel: t.channel,
      name: t.name,
      subject: t.subject ?? null,
      body: t.body,
      category: t.category,
    }));
    const { error: tplErr } = await db.from("message_templates").insert(tplRows);
    if (tplErr) return { ok: false, error: `Templates: ${tplErr.message}` };
    created.templates = tplRows.length;
  }

  // ---- 4. Communication + careers + brand defaults --------
  const nextSettings: CompanySettings = { ...settings };
  // Careers — only if not already written.
  if (!nextSettings.careers?.intro && !(nextSettings.careers?.benefits?.length)) {
    nextSettings.careers = { intro: STARTER_CAREERS.intro, benefits: STARTER_CAREERS.benefits };
  }
  // Reminders — only if the customer hasn't customised them.
  if (!nextSettings.reminders || Object.keys(nextSettings.reminders).length === 0) {
    nextSettings.reminders = STARTER_REMINDERS;
  }
  // Brand primary — only if no colour set (never clobber a configured brand).
  if (!nextSettings.brand?.primary) {
    nextSettings.brand = { ...(nextSettings.brand ?? {}), primary: STARTER_BRAND_PRIMARY };
  }
  nextSettings.starter_pack_version = STARTER_PACK_VERSION;
  nextSettings.starter_seeded_at = new Date().toISOString();

  const { error: setErr } = await db
    .from("companies")
    .update({ settings: nextSettings })
    .eq("id", companyId);
  if (setErr) return { ok: false, error: `Settings: ${setErr.message}` };

  return { ok: true, created };
}

/** Has this company had the starter pack applied? */
export async function isCompanySeeded(companyId: string): Promise<boolean> {
  const db = createAdminClient();
  const { data } = await db.from("companies").select("settings").eq("id", companyId).single();
  const v = ((data?.settings ?? {}) as CompanySettings).starter_pack_version ?? 0;
  return v >= STARTER_PACK_VERSION;
}
