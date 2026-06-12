import { requireCompany } from "@/modules/auth/queries";

const CARDS = [
  { label: "Open jobs", value: "—", hint: "Phase 1" },
  { label: "Active applicants", value: "—", hint: "Phase 2" },
  { label: "Onboarding in progress", value: "—", hint: "Phase 4" },
  { label: "Hires this month", value: "—", hint: "Phase 5" },
];

export default async function DashboardPage() {
  const { current, profile } = await requireCompany();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-1 text-sm text-gray-600">
        {current.companies.name} · your recruitment at a glance
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-gray-200 bg-white p-5"
          >
            <p className="text-sm text-gray-600">{c.label}</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">
              {c.value}
            </p>
            <p className="mt-1 text-xs text-gray-400">Coming in {c.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
        <h2 className="text-base font-medium text-gray-900">
          Phase 0 complete — foundations are live
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Multi-tenant workspace, secure sign-in and company roles are working.
          Next up: job management and your public careers page.
        </p>
      </div>
    </div>
  );
}
