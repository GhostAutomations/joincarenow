import { requirePlatformAdmin } from "@/modules/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";

type Row = {
  id: string;
  role: string;
  company_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePlatformAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();

  const [{ data: rows }, { data: companies }] = await Promise.all([
    db.from("company_users").select("id, role, company_id, profiles(full_name, email)"),
    db.from("companies").select("id, name"),
  ]);

  const companyName = new Map<string, string>();
  for (const c of companies ?? []) companyName.set(c.id as string, c.name as string);

  // Count how many companies each email belongs to (to flag duplicates).
  const emailCount = new Map<string, number>();
  for (const r of (rows ?? []) as unknown as Row[]) {
    const e = r.profiles?.email?.toLowerCase();
    if (e) emailCount.set(e, (emailCount.get(e) ?? 0) + 1);
  }

  const term = (q ?? "").trim().toLowerCase();
  let users = (rows ?? []) as unknown as Row[];
  if (term) {
    users = users.filter((r) => {
      const name = r.profiles?.full_name?.toLowerCase() ?? "";
      const email = r.profiles?.email?.toLowerCase() ?? "";
      const co = (companyName.get(r.company_id) ?? "").toLowerCase();
      return name.includes(term) || email.includes(term) || co.includes(term);
    });
  }
  users = users.sort((a, b) =>
    (a.profiles?.full_name || a.profiles?.email || "").localeCompare(b.profiles?.full_name || b.profiles?.email || "")
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-white drop-shadow-sm">Users</h1>
      <p className="mt-1 text-sm text-white/80">Every staff user across all companies.</p>

      <form className="mt-4" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search name, email or company…"
          className="w-full max-w-md rounded-lg border border-white/40 bg-white/90 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
        />
      </form>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/40 bg-white/55 backdrop-blur-md shadow-sm">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((r) => {
              const email = r.profiles?.email ?? "—";
              const dup = email !== "—" && (emailCount.get(email.toLowerCase()) ?? 0) > 1;
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.profiles?.full_name || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {email}
                    {dup && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        in {emailCount.get(email.toLowerCase())} companies
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{companyName.get(r.company_id) ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-gray-700">
                      {r.role}
                    </span>
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
