import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { SettingsHub, type SettingsSection } from "@/components/dashboard/settings-hub";
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
import { FounderSetupChecklist } from "@/components/founder/setup-checklist";
import { WorkflowApplyPanel } from "@/components/founder/workflow-apply-panel";
import type { OpeningHours } from "@/lib/opening-hours";

export default async function CompanySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: company }, { data: branches }, { data: roles }, { data: storeWfRows }, { data: appliedRows }] = await Promise.all([
    db.from("companies").select("id, name, slug, settings").eq("id", id).single(),
    db.from("branches").select("id, name").eq("company_id", id).order("name"),
    db.from("roles").select("id, name").eq("company_id", id).order("name"),
    db
      .from("onboarding_templates")
      .select("workflow_id, workflow_name, store_category, store_description, position")
      .eq("is_store", true)
      .eq("store_published", true)
      .order("workflow_id", { ascending: true })
      .order("position", { ascending: true }),
    db
      .from("onboarding_templates")
      .select("workflow_name")
      .eq("company_id", id)
      .eq("is_store", false),
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
  };
  const seeded = (settings.starter_pack_version ?? 0) >= 1;

  // Founder setup progress — each task links to its section (?s=<key>).
  const base = `/founder/companies/${id}`;
  const setupTasks = [
    { label: "Add branding (logo & colours)", hint: "Upload their logo and set brand colours.", href: `${base}?s=branding`, done: Boolean(settings.brand?.logo_url) },
    { label: "Set up branches", hint: "Add their branches / locations.", href: `${base}?s=branches`, done: (branches ?? []).length > 0 },
    { label: "Review roles", hint: "Default care roles are seeded — adjust if needed.", href: `${base}?s=roles`, done: (roles ?? []).length > 0 },
    { label: "Apply a workflow", hint: "Pick an onboarding workflow and assign it to a role.", href: `${base}?s=workflows`, done: appliedNames.length > 0 },
    { label: "Set the careers page", hint: "Intro and benefits shown to candidates.", href: `${base}?s=careers`, done: Boolean(settings.careers?.intro) },
    { label: "Set opening hours", hint: "Constrains interview scheduling.", href: `${base}?s=hours`, done: Boolean(settings.opening_hours && Object.keys(settings.opening_hours).length > 0) },
    { label: "Notify the customer", hint: "Send the account-ready email once you're done.", href: `${base}`, done: Boolean(settings.ready_email_sent_at) },
  ];

  const sections: SettingsSection[] = [
    {
      key: "branding",
      label: "Branding",
      description: "Logo and brand colours used across their dashboard and careers page.",
      content: <BrandingForm companyId={id} brand={settings.brand ?? {}} />,
    },
    {
      key: "branches",
      label: "Branches",
      description: "Set up branches once; they become selectable on jobs and follow each hire.",
      content: <BranchesManager branches={branches ?? []} companyId={id} />,
    },
    {
      key: "roles",
      label: "Roles",
      description: "Define roles once (e.g. Walker, Driver); they follow each hire onto their record.",
      content: <RolesManager roles={roles ?? []} companyId={id} />,
    },
    {
      key: "workflows",
      label: "Workflows",
      description: "Apply your ready-made onboarding workflows. Each copies into this company and they own their copy — your master is untouched.",
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
      key: "careers",
      label: "Careers page",
      description: "Intro and benefits shown to candidates on the public careers page.",
      content: (
        <CareersContentForm
          companyId={id}
          intro={settings.careers?.intro ?? ""}
          benefits={settings.careers?.benefits ?? []}
        />
      ),
    },
    {
      key: "numbers",
      label: "Employee numbers",
      description: "Choose how each new hire's Employee ID is set.",
      content: (
        <EmployeeNumberSettings
          companyId={id}
          mode={settings.employee_number_mode === "manual" ? "manual" : "auto"}
          prefix={settings.employee_number_prefix ?? "EMP-"}
        />
      ),
    },
    {
      key: "interview",
      label: "Interview address",
      description: "Default address for in-person interviews.",
      content: <InterviewAddressForm companyId={id} defaultValue={settings.interview_address ?? ""} />,
    },
    {
      key: "hours",
      label: "Opening hours",
      description: "Days and hours the office is open; constrains interview scheduling.",
      content: <OpeningHoursForm companyId={id} hours={settings.opening_hours ?? {}} />,
    },
    {
      key: "communication",
      label: "Communication",
      description: "Automated reminders to applicants and new starters — on/off and channel.",
      content: <ReminderSettingsForm companyId={id} prefs={settings.reminders ?? {}} />,
    },
  ];

  return (
    <div>
      <Link href="/founder/companies" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Set up {company.name}</h1>
      <p className="mt-1 text-sm text-white/80">
        Pre-configure this company so their team can start straight away. Contracts, policies and
        application forms are still built inside the company&apos;s own Settings.
      </p>
      <div className="mt-6 space-y-4">
        <StarterPackPanel companyId={id} seeded={seeded} seededAt={settings.starter_seeded_at ?? null} />
        <FounderSetupChecklist tasks={setupTasks} />
        <AccountReadyButton companyId={id} sentAt={settings.ready_email_sent_at ?? null} />
      </div>
      <div className="mt-6">
        <SettingsHub sections={sections} />
      </div>
    </div>
  );
}
