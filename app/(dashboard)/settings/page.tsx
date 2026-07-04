import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireCompany } from "@/modules/auth/queries";
import { INVITE_ROLES, COMPANY_ROLE_LABEL } from "@/lib/roles";
import { InviteForm } from "@/components/dashboard/invite-form";
import { PendingInvites } from "@/components/dashboard/pending-invites";
import { InterviewAddressForm } from "@/components/dashboard/interview-address-form";
import { BranchesManager } from "@/components/dashboard/branches-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { DocsManager } from "@/components/dashboard/docs-manager";
import { EmployeeNumberSettings } from "@/components/dashboard/employee-number-settings";
import { OpeningHoursForm } from "@/components/dashboard/opening-hours-form";
import { SidebarToggle } from "@/components/dashboard/sidebar-toggle";
import { CareersContentForm } from "@/components/dashboard/careers-content-form";
import { ReminderSettingsForm, type ReminderPrefs } from "@/components/dashboard/reminder-settings-form";
import { RubyPanel } from "@/components/dashboard/ruby-panel";
import { DocumentDetailsForm } from "@/components/dashboard/document-details-form";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";
import { readDocDefaults } from "@/lib/documents/fill";
import { readRubyConfig } from "@/lib/ruby/config";
import { rubyAllowanceUsed } from "@/lib/billing/ruby-credits";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsHub, type SettingsSection } from "@/components/dashboard/settings-hub";
import type { OpeningHours } from "@/lib/opening-hours";

export default async function SettingsPage() {
  const { supabase, current } = await requireCompany();
  // Settings (incl. branding, forms config, billing and team management) is
  // admin-only. Registered Individual / Manager / Recruiter are operational.
  if (current.role !== "admin") redirect("/dashboard");
  const isAdmin = true;

  const { data: members } = await supabase
    .from("company_users")
    .select("id, role, profiles ( full_name, email )")
    .eq("company_id", current.company_id);

  const [{ data: branches }, { data: roles }, { data: contractDocs }, { data: policyDocs }, { data: jobDescDocs }] = await Promise.all([
    supabase.from("branches").select("id, name, kind").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name, team").eq("company_id", current.company_id).order("team").order("position").order("name"),
    isAdmin
      ? supabase.from("contract_templates").select("id, name, body, version").eq("company_id", current.company_id).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("policy_documents").select("id, name, body, version").eq("company_id", current.company_id).order("name")
      : Promise.resolve({ data: [] }),
    isAdmin
      ? supabase.from("job_descriptions").select("id, name, body, version").eq("company_id", current.company_id).order("name")
      : Promise.resolve({ data: [] }),
  ]);

  const { data: companyRow } = await supabase
    .from("companies")
    .select("settings, ruby_enabled")
    .eq("id", current.company_id)
    .single();
  const settings = (companyRow?.settings as {
    interview_address?: string;
    employee_number_mode?: string;
    employee_number_prefix?: string;
  } | null) ?? {};
  const interviewAddress = settings.interview_address ?? "";
  const empNumberMode = settings.employee_number_mode === "manual" ? "manual" : "auto";
  const empNumberPrefix = settings.employee_number_prefix ?? "EMP-";
  const openingHours =
    ((companyRow?.settings as { opening_hours?: OpeningHours } | null)?.opening_hours) ?? {};
  const showSidebar =
    ((companyRow?.settings as { show_sidebar?: boolean } | null)?.show_sidebar) === true;
  const careers =
    ((companyRow?.settings as { careers?: { intro?: string; benefits?: string[] } } | null)?.careers) ?? {};
  const reminderPrefs =
    ((companyRow?.settings as { reminders?: ReminderPrefs } | null)?.reminders) ?? {};
  const rubyEnabled = companyRow?.ruby_enabled === true;
  const rubyConfig = readRubyConfig(companyRow?.settings);
  const rubyUsage = rubyEnabled ? await rubyAllowanceUsed(current.company_id) : null;

  // Admins manage invitations. RLS only returns this company's invites.
  const { data: invites } = isAdmin
    ? await supabase
        .from("invitations")
        .select("id, email, role, expires_at, invited_name")
        .eq("company_id", current.company_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  const teamList = (
    <>
      <ul className="divide-y divide-gray-100">
        {(members ?? []).map((m) => {
          const profile = m.profiles as unknown as {
            full_name: string | null;
            email: string;
          } | null;
          return (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {profile?.full_name || profile?.email}
                </p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                {COMPANY_ROLE_LABEL[m.role as string] ?? m.role}
              </span>
            </li>
          );
        })}
      </ul>
      {!isAdmin && (
        <p className="mt-4 text-xs text-gray-400">
          Only company admins can invite or manage team members.
        </p>
      )}
    </>
  );

  const sections: SettingsSection[] = [
    {
      key: "company",
      label: "Company",
      description: "Your company name and public careers address.",
      content: (
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="mt-0.5 font-medium text-gray-900">{current.companies.name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Careers page address</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              joincarenow.com/careers/{current.companies.slug}
            </dd>
          </div>
        </dl>
      ),
    },
  ];

  if (isAdmin) {
    sections.push(
      {
        key: "navigation",
        label: "Navigation",
        description: "Choose how your team moves around the platform.",
        content: <SidebarToggle companyId={current.company_id} show={showSidebar} />,
      },
      {
        key: "careers",
        label: "Careers page",
        description: "Intro and benefits shown to candidates on your public careers page.",
        content: (
          <CareersContentForm
            companyId={current.company_id}
            intro={careers.intro ?? ""}
            benefits={careers.benefits ?? []}
          />
        ),
      },
      {
        key: "branches",
        label: "Branches",
        description: "Set up branches once; they become selectable on jobs and follow each hire.",
        content: <BranchesManager branches={branches ?? []} companyId={current.company_id} />,
      },
      {
        key: "roles",
        label: "Roles",
        description: "Define roles once (e.g. Walker, Driver); they follow each hire onto their record.",
        content: <RolesManager roles={roles ?? []} companyId={current.company_id} />,
      },
      {
        key: "contracts",
        label: "Contracts & policies",
        description: "Build contracts and policy documents; assign them to jobs for sign-on-accept.",
        content: (
          <div className="space-y-6">
            <CollapsibleSection title="Document details">
              <DocumentDetailsForm details={readDocDefaults(companyRow?.settings)} />
            </CollapsibleSection>
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-medium text-gray-900">Contract templates</h3>
              <p className="mb-3 mt-0.5 text-xs text-gray-500">
                The employment contract the applicant signs on accepting an offer.
              </p>
              <DocsManager kind="contract" items={contractDocs ?? []} />
            </div>
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-medium text-gray-900">Policy documents</h3>
              <p className="mb-3 mt-0.5 text-xs text-gray-500">
                Handbook, GDPR, code of conduct, etc. The applicant acknowledges each one.
              </p>
              <DocsManager kind="policy" items={policyDocs ?? []} />
            </div>
          </div>
        ),
      },
      {
        key: "jobdescriptions",
        label: "Job descriptions",
        description: "Write or AI-generate reusable job descriptions; pick one when you create a job.",
        content: (
          <div>
            <p className="mb-3 text-xs text-gray-500">
              Each job advert uses one of these. Editing a description updates every job that uses it.
            </p>
            <DocsManager kind="job_description" items={jobDescDocs ?? []} />
          </div>
        ),
      },
      {
        key: "numbers",
        label: "Employee numbers",
        description: "Choose how each new hire's Employee ID is set.",
        content: (
          <EmployeeNumberSettings
            companyId={current.company_id}
            mode={empNumberMode}
            prefix={empNumberPrefix}
          />
        ),
      },
      {
        key: "interview",
        label: "Interview address",
        description: "Your default address for in-person interviews.",
        content: (
          <InterviewAddressForm companyId={current.company_id} defaultValue={interviewAddress} />
        ),
      },
      {
        key: "hours",
        label: "Opening hours",
        description: "Days and hours your office is open; constrains interview scheduling.",
        content: <OpeningHoursForm companyId={current.company_id} hours={openingHours} />,
      },
      {
        key: "communication",
        label: "Communication",
        description: "Automated reminders to applicants and new starters — on/off and channel.",
        content: <ReminderSettingsForm companyId={current.company_id} prefs={reminderPrefs} />,
      },
      ...(rubyEnabled
        ? [
            {
              key: "ruby",
              label: "Ruby",
              description:
                "Configure your AI recruitment agent — attributes, focus, custom instructions, and how many questions it asks.",
              content: <RubyPanel config={rubyConfig} usage={rubyUsage} />,
            },
          ]
        : []),
      {
        key: "team",
        label: "Team",
        description: "Invite managers and recruiters, and see who's on your team.",
        content: (
          <div className="space-y-6">
            <div>
              <InviteForm companyId={current.company_id} roles={INVITE_ROLES} />
              <h3 className="mt-6 text-sm font-medium text-gray-900">Pending invitations</h3>
              <PendingInvites invites={invites ?? []} canResend />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-900">Team members</h3>
              <div className="mt-2">{teamList}</div>
            </div>
          </div>
        ),
      }
    );
  } else {
    sections.push({
      key: "team",
      label: "Team",
      description: "See who's on your team.",
      content: teamList,
    });
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle={current.companies.name} />
      <Suspense fallback={null}>
        <SettingsHub sections={sections} />
      </Suspense>
    </div>
  );
}
