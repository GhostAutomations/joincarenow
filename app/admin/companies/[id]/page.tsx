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
import type { OpeningHours } from "@/lib/opening-hours";

export default async function CompanySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePlatformAdmin();
  const db = createAdminClient();

  const [{ data: company }, { data: branches }, { data: roles }] = await Promise.all([
    db.from("companies").select("id, name, slug, settings").eq("id", id).single(),
    db.from("branches").select("id, name").eq("company_id", id).order("name"),
    db.from("roles").select("id, name").eq("company_id", id).order("name"),
  ]);
  if (!company) notFound();

  const settings = (company.settings ?? {}) as {
    interview_address?: string;
    employee_number_mode?: string;
    employee_number_prefix?: string;
    opening_hours?: OpeningHours;
    careers?: { intro?: string; benefits?: string[] };
    reminders?: ReminderPrefs;
  };

  const sections: SettingsSection[] = [
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
      <Link href="/admin/companies" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to companies
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-white drop-shadow-sm">Set up {company.name}</h1>
      <p className="mt-1 text-sm text-white/80">
        Pre-configure this company so their team can start straight away. Contracts, policies and
        application forms are still built inside the company&apos;s own Settings.
      </p>
      <div className="mt-6">
        <SettingsHub sections={sections} />
      </div>
    </div>
  );
}
