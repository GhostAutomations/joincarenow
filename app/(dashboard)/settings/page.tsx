import { requireCompany } from "@/modules/auth/queries";
import { InviteForm } from "@/components/dashboard/invite-form";
import { PendingInvites } from "@/components/dashboard/pending-invites";
import { InterviewAddressForm } from "@/components/dashboard/interview-address-form";
import { BranchesManager } from "@/components/dashboard/branches-manager";
import { RolesManager } from "@/components/dashboard/roles-manager";
import { EmployeeNumberSettings } from "@/components/dashboard/employee-number-settings";
import { OpeningHoursForm } from "@/components/dashboard/opening-hours-form";
import { SidebarToggle } from "@/components/dashboard/sidebar-toggle";
import type { OpeningHours } from "@/lib/opening-hours";

export default async function SettingsPage() {
  const { supabase, current } = await requireCompany();
  const isAdmin = current.role === "admin";

  const { data: members } = await supabase
    .from("company_users")
    .select("id, role, profiles ( full_name, email )")
    .eq("company_id", current.company_id);

  const [{ data: branches }, { data: roles }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("company_id", current.company_id).order("name"),
    supabase.from("roles").select("id, name").eq("company_id", current.company_id).order("name"),
  ]);

  const { data: companyRow } = await supabase
    .from("companies")
    .select("settings")
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

  // Admins manage invitations. RLS only returns this company's invites.
  const { data: invites } = isAdmin
    ? await supabase
        .from("invitations")
        .select("id, email, role, expires_at")
        .eq("company_id", current.company_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
        <h2 className="text-base font-medium text-gray-900">Company</h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Name</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              {current.companies.name}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Careers page address</dt>
            <dd className="mt-0.5 font-medium text-gray-900">
              joincarenow.com/careers/{current.companies.slug}
            </dd>
          </div>
        </dl>
      </section>

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Navigation</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose how your team moves around the platform.
          </p>
          <SidebarToggle companyId={current.company_id} show={showSidebar} />
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Branches</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set up your branches once. They become selectable on jobs and follow
            each new hire onto their employee record — no duplicate or mistyped locations.
          </p>
          <div className="mt-4">
            <BranchesManager branches={branches ?? []} />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Roles</h2>
          <p className="mt-1 text-sm text-gray-500">
            Define your roles once (e.g. Walker, Driver). They become selectable
            on jobs and follow each hire onto their employee record.
          </p>
          <div className="mt-4">
            <RolesManager roles={roles ?? []} />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Employee numbers</h2>
          <p className="mt-1 text-sm text-gray-500">
            Choose how each new hire&apos;s Employee ID is set.
          </p>
          <EmployeeNumberSettings
            companyId={current.company_id}
            mode={empNumberMode}
            prefix={empNumberPrefix}
          />
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">
            Interview address
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Your default address for in-person interviews. It pre-fills the
            location when you schedule an in-person interview.
          </p>
          <InterviewAddressForm
            companyId={current.company_id}
            defaultValue={interviewAddress}
          />
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">Opening hours</h2>
          <p className="mt-1 text-sm text-gray-500">
            Set the days and hours your office is open. Interviews can only be
            scheduled — and applicants can only propose times — within these hours.
          </p>
          <OpeningHoursForm companyId={current.company_id} hours={openingHours} />
        </section>
      )}

      {isAdmin && (
        <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
          <h2 className="text-base font-medium text-gray-900">
            Invite a team member
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Invite managers and recruiters to {current.companies.name}. They set
            their own password from the invitation link.
          </p>
          <div className="mt-4">
            <InviteForm
              companyId={current.company_id}
              roles={[
                { value: "manager", label: "Manager" },
                { value: "recruiter", label: "Recruiter" },
              ]}
            />
          </div>

          <h3 className="mt-8 text-sm font-medium text-gray-900">
            Pending invitations
          </h3>
          <PendingInvites invites={invites ?? []} />
        </section>
      )}

      <section className="mt-6 rounded-2xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-sm p-6">
        <h2 className="text-base font-medium text-gray-900">Team members</h2>
        <ul className="mt-4 divide-y divide-gray-100">
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
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                  {m.role}
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
      </section>
    </div>
  );
}
