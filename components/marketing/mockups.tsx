import { Check, Clock } from "lucide-react";

/** Faux browser window chrome around a product mockup. Decorative only. */
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl ring-1 ring-black/5">
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 hidden flex-1 rounded-md bg-white px-3 py-1 text-[11px] text-gray-400 sm:block">
          app.joincarenow.com/pipeline
        </span>
      </div>
      <div className="bg-gray-50 p-4">{children}</div>
    </div>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white ${color}`}>
      {initials}
    </span>
  );
}

function Card({
  initials,
  color,
  name,
  role,
  chip,
  chipClass,
}: {
  initials: string;
  color: string;
  name: string;
  role: string;
  chip: string;
  chipClass: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center gap-2">
        <Avatar initials={initials} color={color} />
        <div className="min-w-0">
          <p className="truncate text-[12px] font-semibold text-gray-900">{name}</p>
          <p className="truncate text-[10px] text-gray-500">{role}</p>
        </div>
      </div>
      <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-medium ${chipClass}`}>{chip}</span>
    </div>
  );
}

/** Hiring-board mockup (mirrors the real pipeline). Decorative. */
export function BoardMockup() {
  const columns = [
    {
      title: "Contact ready",
      count: 3,
      cards: [
        { initials: "AM", color: "bg-rose-500", name: "Aisha Malik", role: "Care Assistant", chip: "New", chipClass: "bg-gray-100 text-gray-600" },
        { initials: "TO", color: "bg-sky-500", name: "Tom O'Brien", role: "Support Worker", chip: "New", chipClass: "bg-gray-100 text-gray-600" },
      ],
    },
    {
      title: "Screening",
      count: 2,
      cards: [
        { initials: "RP", color: "bg-violet-500", name: "Rhys Price", role: "Senior Carer", chip: "DBS pending", chipClass: "bg-amber-100 text-amber-700" },
      ],
    },
    {
      title: "Interview",
      count: 2,
      cards: [
        { initials: "GE", color: "bg-emerald-500", name: "Grace Evans", role: "Care Assistant", chip: "Booked", chipClass: "bg-brand-100 text-brand-700" },
      ],
    },
    {
      title: "Hired",
      count: 5,
      cards: [
        { initials: "SJ", color: "bg-teal-500", name: "Sarah Jones", role: "Support Worker", chip: "Onboarded", chipClass: "bg-green-100 text-green-700" },
      ],
    },
  ];

  return (
    <BrowserFrame>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {columns.map((col) => (
          <div key={col.title} className="rounded-xl bg-white/60 p-2">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-semibold text-gray-700">{col.title}</span>
              <span className="rounded-full bg-gray-200 px-1.5 text-[10px] font-medium text-gray-600">{col.count}</span>
            </div>
            <div className="space-y-2">
              {col.cards.map((c) => (
                <Card key={c.name} {...c} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

/** Onboarding checklist card mockup. Decorative. */
export function OnboardingMockup() {
  const rows = [
    { label: "Right to Work", status: "done" },
    { label: "DBS check", status: "done" },
    { label: "References", status: "progress" },
    { label: "Employment history", status: "done" },
    { label: "Contract signed", status: "done" },
    { label: "Policies acknowledged", status: "progress" },
  ] as const;

  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-teal-500 text-xs font-semibold text-white">SJ</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Sarah Jones</p>
          <p className="text-[11px] text-gray-500">Support Worker · Onboarding</p>
        </div>
        <span className="ml-auto rounded-full bg-brand-100 px-2.5 py-1 text-[10px] font-semibold text-brand-700">4 of 6 complete</span>
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-700">{r.label}</span>
            {r.status === "done" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                <Check className="h-3 w-3" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                <Clock className="h-3 w-3" /> In progress
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
