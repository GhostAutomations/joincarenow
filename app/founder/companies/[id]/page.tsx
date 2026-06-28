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
import { CareersContentForm } from "@/components/dashboard/careers-content-form";
import { InterviewAddressForm } from "@/components/dashboard/interview-address-form";
import { BrandingForm } from "@/components/dashboard/branding-form";
import { StarterPackPanel } from "@/components/founder/starter-pack-panel";
import { AccountReadyButton } from "@/components/founder/account-ready-button";
import { FounderSetupWizard, type WizardTask } from "@/components/founder/setup-wizard";
import { WorkflowApplyPanel } from "@/components/founder/workflow-apply-panel";
import { manageAsCompany } from "@/modules/founder/actions";
import type { OpeningHours } from "@/lib/opening-hours";

/** A founder setup task that drops into the company's own Settings (manage-as-
 *  company) to build documents there, where paste / upload / AI / merge live. */
function docSetupTask(companyId: string, count: number, noun: string, section: string) {
  return (
    <div>
      <p className="text-sm text-gray-600">
        {count > 0 ? `${count} already set up. ` : "None yet. "}
        Build {noun} for this company — paste them in, upload a Word/text file, or generate with AI, and drop in merge fields.
      </p>
      <form action={manageAsCompany} className="mt-3">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="next" value={`/settings?s=${section}`} />
        <button className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Set up {noun} →
        </button>
      </form>
      <p className="mt-2 text-xs text-gray-500">
        Opens this company&apos;s Settings (managing as them). Use &quot;Stop managing&quot; to return.
      </p>
    </div>
  );
}

export default async function CompanySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: company }, { data: branches }, { data: roles }, { data: storeWfRows }, { data: appliedRows }, { count: contractCount }, { count: policyCount }, { count: jobDescCount }] = await Promise.all([
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
    db.from("contract_templates").select("id", { count: "exact", head: true }).eq("company_id", id),
    db.from("policy_documents").select("id", { count: "exact", head: true }).eq("company_id", id),
    db.from("job_descriptions").select("id", { count: "exact", head: true }).eq("company_id", id),
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
  };
  const seeded = (settings.starter_pack_version ?? 0) >= 1;
  const checked = settings.setup_checked ?? {};
  // Setup completion for the notify warning — the nine setup tasks (NOT the
  // notify action itself), so all-done = 100% = no warning.
  const SETUP_KEYS = ["branding", "branches", "roles", "workflows", "contracts", "policies", "jobdescriptions", "careers", "numbers", "interview", "hours", "communication"];
  const setupPct = Math.round((SETUP_KEYS.filter((k) => checked[k] === true).length / SETUP_KEYS.length) * 100);

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
      description: "Employment contracts the applicant signs on accepting an offer.",
      content: docSetupTask(id, contractCount ?? 0, "contracts", "contracts"),
    },
    {
      key: "policies", label: "Policies", isManager: true, done: checked.policies === true,
      description: "Handbook, GDPR, code of conduct, etc. — acknowledged by the applicant.",
      content: docSetupTask(id, policyCount ?? 0, "policies", "contracts"),
    },
    {
      key: "jobdescriptions", label: "Job descriptions", isManager: true, done: checked.jobdescriptions === true,
      description: "Reusable job descriptions selected when creating a job.",
      content: docSetupTask(id, jobDescCount ?? 0, "job descriptions", "jobdescriptions"),
    },
    {
      key: "careers", label: "Careers page", isManager: false, done: checked.careers === true,
      description: "Intro and benefits shown to candidates on the public careers page.",
      content: <CareersContentForm companyId={id} intro={settings.careers?.intro ?? ""} benefits={settings.careers?.benefits ?? []} submitLabel={FINALISE} />,
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
      content: <AccountReadyButton companyId={id} sentAt={settings.ready_email_sent_at ?? null} setupPct={setupPct} />,
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
        <FounderSetupWizard companyId={id} tasks={wizardTasks} />
      </div>
    </div>
  );
}
