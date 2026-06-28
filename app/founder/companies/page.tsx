import { Settings, Eye } from "lucide-react";
import { requirePlatformAdmin } from "@/modules/auth/queries";
import { manageAsCompany } from "@/modules/founder/actions";
import { CompanyForm } from "@/components/dashboard/company-form";
import { DeleteCompany } from "@/components/dashboard/delete-company";
import { InviteForm } from "@/components/dashboard/invite-form";
import { PendingInvites } from "@/components/dashboard/pending-invites";
import { parseConcession, describeConcession } from "@/lib/billing/concession";
type AdminRow = {
  company_id: string;
  profiles: { full_name: string | null; email: string } | null;
};

const PLAN_LABEL: Record<string, string> = {
  monthly: "12 Month + Setup",
  commit: "12 Month Fixed",
  annual: "Annual",
  diamond: "Diamond (usage only)",
};

/** Read-only billing status for a company (customers subscribe via the CRM
 *  onboarding + Stripe, so the founder doesn't set a plan here). */
function billingStatus(c: {
  billing_status?: string | null;
  billing_comped?: boolean | null;
  billing_interval?: string | null;
  agreed_plan?: string | null;
}): { label: string; cls: string; plan: string | null } {
  const plan =
    PLAN_LABEL[c.agreed_plan ?? ""] ??
    (c.billing_interval === "year" ? "Annual" : c.billing_interval === "month" ? "Monthly" : null);
  if (c.billing_comped) return { label: "Complimentary", cls: "bg-violet-100 text-violet-700", plan };
  switch (c.billing_status) {
    case "active":
    case "trialing":
      return { label: "Active", cls: "bg-green-100 text-green-700", plan };
    case "past_due":
      return { label: "Past due", cls: "bg-amber-100 text-amber-800", plan };
    case "canceled":
      return { label: "Cancelled", cls: "bg-gray-200 text-gray-600", plan };
    default:
      return { label: "Not subscribed", cls: "bg-gray-100 text-gray-600", plan };
  }
}

export default async function CompaniesPage() {
  const { supabase } = await requirePlatformAdmin();

  const [{ data: companies }, { data: admins }, { data: adminInvites }, { data: agreements }] =
    await Promise.all([
      supabase.from("companies").select("id, name, slug, billing_status, billing_comped, billing_interval, agreed_plan, agreed_offer").order("name"),
      supabase
        .from("company_users")
        .select("company_id, profiles ( full_name, email )")
        .eq("role", "admin"),
      supabase
        .from("invitations")
        .select("id, company_id, email, role, expires_at, invited_name")
        .eq("status", "pending")
        .eq("role", "admin")
        .order("created_at", { ascending: false }),
      supabase
        .from("company_agreements")
        .select("company_id, signer_name, agreed_at")
        .order("agreed_at", { ascending: false }),
    ]);

  const agreementByCompany = new Map<string, { signer_name: string; agreed_at: string }>();
  for (const ag of agreements ?? []) {
    if (!agreementByCompany.has(ag.company_id)) {
      agreementByCompany.set(ag.company_id, { signer_name: ag.signer_name as string, agreed_at: ag.agreed_at as string });
    }
  }

  const adminsByCompany = new Map<string, AdminRow[]>();
  for (const a of (admins ?? []) as unknown as AdminRow[]) {
    const list = adminsByCompany.get(a.company_id) ?? [];
    list.push(a);
    adminsByCompany.set(a.company_id, list);
  }

  const invitesByCompany = new Map<
    string,
    { id: string; email: string; role: string; expires_at: string; invited_name?: string | null }[]
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

      <section className="mt-6 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm">
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
          <div className="mt-3 rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-8 text-center text-sm text-gray-600 shadow-sm">
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
                className="rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {c.name}
                    </h3>
                    <p className="text-xs text-gray-600">
                      joincarenow.com/careers/{c.slug}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                    {companyAdmins.length} admin
                    {companyAdmins.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={manageAsCompany} className="flex-1">
                    <input type="hidden" name="companyId" value={c.id} />
                    <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
                      <Eye className="h-4 w-4" /> Manage as this company
                    </button>
                  </form>
                  <a
                    href={`/founder/companies/${c.id}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-100"
                  >
                    <Settings className="h-4 w-4" /> Quick setup
                  </a>
                </div>

                {companyAdmins.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {companyAdmins.map((a, idx) => (
                      <li key={idx} className="text-sm text-gray-700">
                        {a.profiles?.full_name || a.profiles?.email}{" "}
                        <span className="text-gray-600">
                          ({a.profiles?.email})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {(() => {
                  const b = billingStatus(c as Parameters<typeof billingStatus>[0]);
                  const offer = describeConcession(parseConcession((c as { agreed_offer?: string | null }).agreed_offer ?? null));
                  return (
                    <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-sm text-gray-600">Subscription</span>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.cls}`}>{b.label}</span>
                        {b.plan && <span className="text-xs text-gray-600">· {b.plan}</span>}
                        <a href={`/founder/billing/${c.id}`} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                          Billing details →
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-20 shrink-0 text-sm text-gray-600">Sign-up offer</span>
                        {offer ? (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">{offer}</span>
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">No offer</span>
                        )}
                      </div>
                      {(() => {
                        const ag = agreementByCompany.get(c.id);
                        return (
                          <div className="flex items-center gap-2">
                            <span className="w-20 shrink-0 text-sm text-gray-600">Agreement</span>
                            {ag ? (
                              <>
                                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                                  Signed {new Date(ag.agreed_at).toLocaleDateString("en-GB")}
                                </span>
                                <span className="text-xs text-gray-600">by {ag.signer_name}</span>
                                <a href={`/api/agreement/pdf?company=${c.id}`} className="ml-auto text-xs font-medium text-brand-600 hover:underline">
                                  Download PDF
                                </a>
                              </>
                            ) : (
                              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">Not signed</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

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

                <div className="mt-4 flex justify-end border-t border-gray-100 pt-3">
                  <DeleteCompany companyId={c.id} companyName={c.name} />
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
