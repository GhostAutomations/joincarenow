import { requirePlatformAdmin } from "@/modules/auth/queries";
import { CompanyForm } from "@/components/dashboard/company-form";
import { InviteForm } from "@/components/dashboard/invite-form";
import { PendingInvites } from "@/components/dashboard/pending-invites";
import { setCompanyTier } from "@/modules/forms/actions";
import { TIERS, TIER_LABEL } from "@/modules/forms/tiers";

type AdminRow = {
  company_id: string;
  profiles: { full_name: string | null; email: string } | null;
};

export default async function CompaniesPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: companies }, { data: admins }, { data: adminInvites }] =
    await Promise.all([
      supabase.from("companies").select("id, name, slug, subscription_tier").order("name"),
      supabase
        .from("company_users")
        .select("company_id, profiles ( full_name, email )")
        .eq("role", "admin"),
      supabase
        .from("invitations")
        .select("id, company_id, email, role, expires_at")
        .eq("status", "pending")
        .eq("role", "admin")
        .order("created_at", { ascending: false }),
    ]);

  const adminsByCompany = new Map<string, AdminRow[]>();
  for (const a of (admins ?? []) as unknown as AdminRow[]) {
    const list = adminsByCompany.get(a.company_id) ?? [];
    list.push(a);
    adminsByCompany.set(a.company_id, list);
  }

  const invitesByCompany = new Map<
    string,
    { id: string; email: string; role: string; expires_at: string }[]
  >();
  for (const i of adminInvites ?? []) {
    const list = invitesByCompany.get(i.company_id) ?? [];
    list.push(i);
    invitesByCompany.set(i.company_id, list);
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Companies</h1>
      <p className="mt-1 text-sm text-white/80">
        Create care companies and invite their first administrator. Admins then
        invite their own managers and recruiters.
      </p>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm">
        <h2 className="text-base font-medium text-gray-900">Add a company</h2>
        <div className="mt-4">
          <CompanyForm />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-base font-medium text-white drop-shadow-sm">
          Companies ({companies?.length ?? 0})
        </h2>

        {(companies ?? []).length === 0 && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm text-gray-500 shadow-sm">
            No companies yet. Create your first one above.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {(companies ?? []).map((c) => {
            const companyAdmins = adminsByCompany.get(c.id) ?? [];
            const pending = invitesByCompany.get(c.id) ?? [];
            return (
              <div
                key={c.id}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {c.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      joincarenow.com/careers/{c.slug}
                    </p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {companyAdmins.length} admin
                    {companyAdmins.length === 1 ? "" : "s"}
                  </span>
                </div>

                {companyAdmins.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {companyAdmins.map((a, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {a.profiles?.full_name || a.profiles?.email}{" "}
                        <span className="text-gray-400">
                          ({a.profiles?.email})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <form
                  action={setCompanyTier}
                  className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3"
                >
                  <input type="hidden" name="companyId" value={c.id} />
                  <label className="text-sm text-gray-600">Subscription plan</label>
                  <select
                    name="tier"
                    defaultValue={
                      (c as { subscription_tier?: string }).subscription_tier ?? "free"
                    }
                    className="rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>{TIER_LABEL[t]}</option>
                    ))}
                  </select>
                  <button className="rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-100">
                    Save plan
                  </button>
                </form>

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm font-medium text-gray-900">
                    Invite an administrator
                  </p>
                  <div className="mt-3">
                    <InviteForm
                      companyId={c.id}
                      roles={[{ value: "admin", label: "Administrator" }]}
                    />
                  </div>
                  {pending.length > 0 && (
                    <>
                      <p className="mt-6 text-sm font-medium text-gray-900">
                        Pending admin invitations
                      </p>
                      <PendingInvites invites={pending} />
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
