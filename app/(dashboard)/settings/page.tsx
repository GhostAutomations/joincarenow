import { requireCompany } from "@/modules/auth/queries";

export default async function SettingsPage() {
  const { supabase, current } = await requireCompany();

  const { data: members } = await supabase
    .from("company_users")
    .select("id, role, profiles ( full_name, email )")
    .eq("company_id", current.company_id);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
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

      <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
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
        <p className="mt-4 text-xs text-gray-400">
          Inviting team members, branding, DBS link and payroll contacts arrive
          with their feature phases.
        </p>
      </section>
    </div>
  );
}
