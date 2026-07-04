import { Check, CheckCheck, Clock, MapPin, Banknote, CalendarDays } from "lucide-react";

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
      title: "Applied",
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
        { initials: "GE", color: "bg-emerald-500", name: "Grace Evans", role: "Care Assistant", chip: "Booked", chipClass: "bg-amber-100 text-amber-700" },
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

/** Communication hub mockup — email/SMS thread with delivery status. Decorative. */
export function CommsMockup() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-5 py-3.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-rose-500 text-xs font-semibold text-white">AM</span>
        <div>
          <p className="text-sm font-semibold text-gray-900">Aisha Malik</p>
          <p className="text-[11px] text-gray-500">Care Assistant · Interview</p>
        </div>
        <div className="ml-auto flex gap-1">
          {["All", "Email", "SMS"].map((t, i) => (
            <span key={t} className={`rounded-full px-2.5 py-1 text-[10px] font-medium ${i === 0 ? "bg-[#0d1d4b] text-amber-300" : "bg-gray-100 text-gray-500"}`}>{t}</span>
          ))}
        </div>
      </div>
      <div className="space-y-3 bg-gray-50/60 p-4">
        <div className="flex justify-end">
          <div className="max-w-[85%]">
            <p className="rounded-2xl rounded-br-sm bg-[#0d1d4b] px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-sm">
              Hi Aisha, great news! We&apos;d love to invite you to interview on Tuesday at 10am. Does that work for you?
            </p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
              SMS · Delivered <CheckCheck className="h-3 w-3 text-amber-500" aria-hidden />
            </p>
          </div>
        </div>
        <div className="flex">
          <div className="max-w-[85%]">
            <p className="rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[13px] leading-snug text-gray-800 shadow-sm ring-1 ring-gray-100">
              Yes, Tuesday at 10 is perfect. See you then!
            </p>
            <p className="mt-1 text-[10px] text-gray-400">SMS · Reply</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%]">
            <p className="rounded-2xl rounded-br-sm bg-[#0d1d4b] px-3.5 py-2.5 text-[13px] leading-snug text-white shadow-sm">
              Interview confirmed. Details and directions sent by email.
            </p>
            <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-gray-400">
              Email · Opened <CheckCheck className="h-3 w-3 text-amber-500" aria-hidden />
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Branded careers page mockup. Decorative. */
export function CareersMockup() {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
      <div className="bg-gradient-to-br from-[#081231] via-[#0d1d4b] to-[#14306b] px-5 py-4 text-white">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">Careers at</p>
        <p className="text-lg font-bold">Bay View Care</p>
      </div>
      <div className="p-5">
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Care Assistant (Nights)</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden /> Cardiff</span>
                <span className="inline-flex items-center gap-1"><Banknote className="h-3 w-3" aria-hidden /> £12.60/hr</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden /> Full-time</span>
              </div>
            </div>
            <span className="rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-semibold text-[#081231]">Apply now</span>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Senior Support Worker</p>
              <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden /> Newport</span>
                <span className="inline-flex items-center gap-1"><Banknote className="h-3 w-3" aria-hidden /> £13.40/hr</span>
                <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" aria-hidden /> Full-time</span>
              </div>
            </div>
            <span className="rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-semibold text-[#081231]">Apply now</span>
          </div>
        </div>
        <p className="mt-3 text-center text-[10px] text-gray-400">Your brand, your jobs, found on Google and shared anywhere</p>
      </div>
    </div>
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
        <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700">4 of 6 complete</span>
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
