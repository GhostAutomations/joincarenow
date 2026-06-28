import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { BranchesManager } from "@/components/dashboard/branches-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { EmployeeNumberSettings } from "@/components/dashboard/employee-number-settings";
import { OpeningHoursForm } from "@/components/dashboard/opening-hours-form";
import { ReminderSettingsForm, type ReminderPrefs } from "@/components/dashboard/reminder-settings-form";
import { InterviewAddressForm } from "@/components/dashboard/interview-address-form";
import { BrandingForm } from "@/components/dashboard/branding-form";
import { StarterPackPanel } from "@/components/founder/starter-pack-panel";
import { AccountReadyButton } from "@/components/founder/account-ready-button";
import { FounderSetupWizard, type WizardTask } from "@/components/founder/setup-wizard";
import { WorkflowApplyPanel } from "@/components/founder/workflow-apply-panel";
import { FounderDocsManager } from "@/components/founder/founder-docs-manager";
import { SETUP_TASK_META } from "@/lib/setup-tasks";
import type { OpeningHours } from "@/lib/opening-hours";

export default async function CompanySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: company }, { data: branches }, { data: roles }, { data: storeWfRows }, { data: appliedRows }, { data: contractDocs }, { data: policyDocs }, { data: jobDescDocs }] = await Promise.all([
    db.from("companies").select("id, name, slug, settings").eq("id", id).single(),
    db.from("branches").select("id, name, kind").eq("company_id", id).order("name"),
    db.from("roles").select("id, name, team").eq("company_id", id).order("team").order("position").order("name"),
    db
      .from("onboarding_templates")
      .select("workflow_id, workflow_name, store_category, store_description, position")
      .eq("is_store", true)
      .eq("store_published", true)
      .eq("store_archived", false)
      .order("workflow_id", { ascending: true })
      .order("position", { ascending: true }),
    db
      .from("onboarding_templates")
      .select("workflow_name")
      .eq("company_id", id)
      .eq("is_store", false),
    db.from("contract_templates").select("id, name, body").eq("company_id", id).order("name"),
    db.from("policy_documents").select("id, name, body").eq("company_id", id).order("name"),
    db.from("job_descriptions").select("id, name, body").eq("company_id", id).order("name"),
  ]);
  if (!company) notFound();

  // Group published store workflows for the apply panel.
  const wfMap = new Map<string, { id: string; name: string; category: string | null; description: string | null; stepCount: number }>();
  for (const r of (storeWfRows ?? []) as { workflow_id: string; workflow_name: string; store_category: string | null; store_description: string | null }[]) {
    const e = wfMap.get(r.workflow_id) ?? { id: r.workflow_id, name: r.workflow_name, category: r.store_category, description: r.store_description, stepCount: 0 };
    e.stepCount++;
    wfMap.set(r.workflow_id, e);
  }
  const storeWorkflows = [...wfMap.values()];
  const appliedNames = [...new Set((appliedRows ?? []).map((r) => String((r as { workflow_name: string }).workflow_name)).filter(Boolean))];

  const settings = (company.settings ?? {}) as {
    interview_address?: string;
    employee_number_mode?: string;
    employee_number_prefix?: string;
    opening_hours?: OpeningHours;
    careers?: { intro?: string; benefits?: string[] };
    reminders?: ReminderPrefs;
    brand?: { primary?: string; secondary?: string; accent?: string; logo_url?: string | null };
    starter_pack_version?: number;
    starter_seeded_at?: string;
    ready_email_sent_at?: string;
    setup_checked?: Record<string, boolean>;
    passed_tasks?: string[];
  };
  const seeded = (settings.starter_pack_version ?? 0) >= 1;
  const checked = settings.setup_checked ?? {};
  const passed = settings.passed_tasks ?? [];
  // Setup completion for the notify warning — the nine setup tasks (NOT the
  // notify action itself), so all-done = 100% = no warning.
  const SETUP_KEYS = ["branding", "branches", "roles", "workflows", "contracts", "policies", "jobdescriptions", "numbers", "interview", "hours", "communication"];
  // A task counts as resolved if it's been finalised OR passed to the admin.
  const setupPct = Math.round((SETUP_KEYS.filter((k) => checked[k] === true || passed.includes(k)).length / SETUP_KEYS.length) * 100);
  const outstanding = SETUP_KEYS
    .filter((k) => checked[k] !== true && !passed.includes(k))
    .map((k) => ({ key: k, label: SETUP_TASK_META[k]?.label ?? k }));

  const FINALISE = "Finalise";
  const wizardTasks: WizardTask[] = [
    {
      key: "branding", label: "Branding", isManager: false, done: checked.branding === true,
      description: "Logo and brand colours used across their dashboard and careers page.",
      content: <BrandingForm companyId={id} brand={settings.brand ?? {}} submitLabel={FINALISE} />,
    },
    {
      key: "branches", label: "Branches", isManager: true, done: checked.branches === true,
      description: "Set up branches; they become selectable on jobs and follow each hire.",
      content: <BranchesManager branches={branches ?? []} companyId={id} />,
    },
    {
      key: "roles", label: "Roles", isManager: true, done: checked.roles === true,
      description: "Define roles (e.g. Walker, Driver); they follow each hire onto their record.",
      content: <RolesManager roles={roles ?? []} companyId={id} />,
    },
    {
      key: "workflows", label: "Workflows", isManager: true, done: checked.workflows === true,
      description: "Apply your ready-made onboarding workflows. Each copies in; the company owns their copy.",
      content: (
        <WorkflowApplyPanel
          companyId={id}
          workflows={storeWorkflows}
          roles={(roles ?? []).map((r) => ({ id: String(r.id), name: String(r.name) }))}
          appliedNames={appliedNames}
        />
      ),
    },
    {
      key: "contracts", label: "Contracts", isManager: true, done: checked.contracts === true,
      description: "Employment contracts the applicant signs on accepting an offer. Paste, upload (Word/text) or AI-generate, with merge fields.",
      content: <FounderDocsManager companyId={id} kind="contract" items={contractDocs ?? []} noun="contract" />,
    },
    {
      key: "policies", label: "Policies", isManager: true, done: checked.policies === true,
      description: "Handbook, GDPR, code of conduct, etc. — acknowledged by the applicant. Paste, upload or AI-generate.",
      content: <FounderDocsManager companyId={id} kind="policy" items={policyDocs ?? []} noun="policy" />,
    },
    {
      key: "jobdescriptions", label: "Job descriptions", isManager: true, done: checked.jobdescriptions === true,
      description: "Reusable job descriptions selected when creating a job. Paste, upload or AI-generate.",
      content: <FounderDocsManager companyId={id} kind="job_description" items={jobDescDocs ?? []} noun="job description" />,
    },
    {
      key: "numbers", label: "Employee numbers", isManager: false, done: checked.numbers === true,
      description: "Choose how each new hire's Employee ID is set.",
      content: <EmployeeNumberSettings companyId={id} mode={settings.employee_number_mode === "manual" ? "manual" : "auto"} prefix={settings.employee_number_prefix ?? "EMP-"} submitLabel={FINALISE} />,
    },
    {
      key: "interview", label: "Interview address", isManager: false, done: checked.interview === true,
      description: "Default address for in-person interviews.",
      content: <InterviewAddressForm companyId={id} defaultValue={settings.interview_address ?? ""} submitLabel={FINALISE} />,
    },
    {
      key: "hours", label: "Opening hours", isManager: false, done: checked.hours === true,
      description: "Days and hours the office is open; constrains interview scheduling.",
      content: <OpeningHoursForm companyId={id} hours={settings.opening_hours ?? {}} submitLabel={FINALISE} />,
    },
    {
      key: "communication", label: "Communication", isManager: false, done: checked.communication === true,
      description: "Automated reminders to applicants and new starters — on/off and channel.",
      content: <ReminderSettingsForm companyId={id} prefs={settings.reminders ?? {}} submitLabel={FINALISE} />,
    },
    {
      key: "notify", label: "Notify the customer", isManager: false, done: Boolean(settings.ready_email_sent_at),
      description: "Send the account-ready email so they can log in with full access.",
      content: <AccountReadyButton companyId={id} sentAt={settings.ready_email_sent_at ?? null} setupPct={setupPct} outstanding={outstanding} />,
    },
  ];

  return (
    <div>
      <Link href="/founder/companies" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Set up {company.name}</h1>
      <p className="mt-1 text-sm text-white/80">
        Pre-configure this company so their team can start straight away. Application forms are
        still built inside the company&apos;s own Settings.
      </p>
      <div className="mt-6 space-y-4">
        <StarterPackPanel companyId={id} seeded={seeded} seededAt={settings.starter_seeded_at ?? null} />
        <FounderSetupWizard companyId={id} tasks={wizardTasks.map((t) => ({ ...t, passed: passed.includes(t.key) }))} />
      </div>
    </div>
  );
}
