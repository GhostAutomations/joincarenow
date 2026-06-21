import { CollapsibleSection } from "@/components/dashboard/collapsible-section";

const STAGE_GUIDE: { label: string; tips: string[] }[] = [
  {
    label: "New",
    tips: [
      "A prospect you've just added — no contact made yet.",
      "Add the key contact (registered manager / owner) with an email or phone, and set the care setting and region.",
      "When you're ready to reach out, send a first message or enrol them in a sequence, then move to Contacted.",
    ],
  },
  {
    label: "Contacted",
    tips: [
      "You've sent a first email/SMS (it's logged automatically on the timeline).",
      "Add a follow-up task so they don't go cold.",
      "When they reply or show interest, move to Engaged.",
    ],
  },
  {
    label: "Engaged",
    tips: [
      "They've responded or shown interest — now qualify them.",
      "Note their size, setting and pain points (spreadsheets, staff turnover, CQC/CIW pressure).",
      "Aim to book a demo, then move to Demo booked.",
    ],
  },
  {
    label: "Demo booked",
    tips: [
      "A demo is scheduled. Review their context before the call.",
      "Afterwards, send a recap with clear next steps.",
      "If they want a price, move to Proposal.",
    ],
  },
  {
    label: "Proposal",
    tips: [
      "You've sent pricing / a proposal.",
      "Handle objections (price, switching cost, data migration). Keep following up.",
      "Move to Won when they say yes, or Lost if not.",
    ],
  },
  {
    label: "Won",
    tips: [
      "They're signing up! Create their company in Companies, then pre-build it with Quick setup or Manage as this company.",
      "Hand over a ready-to-use account.",
    ],
  },
  {
    label: "Lost",
    tips: [
      "Not proceeding for now. Add a note on why.",
      "Keep them on file for future — but always respect opt-outs.",
    ],
  },
];

export function CrmGuide() {
  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-4 space-y-3">
        <div className="rounded-2xl border border-white/30 bg-white/15 p-4 text-white backdrop-blur-md">
          <h2 className="text-sm font-semibold">How to use the CRM</h2>
          <p className="mt-1 text-xs text-white/80">
            Add a prospect, work it through the stages left→right, and let the timeline keep the
            history. Use the guides below for what to do at each stage.
          </p>
        </div>

        <CollapsibleSection title="Getting started" defaultOpen>
          <ul className="list-disc space-y-1.5 pl-4 text-sm text-gray-700">
            <li><strong>Add company</strong> with just a name + one email (expand for more).</li>
            <li>Open a record to add contacts, tasks, notes and send email/SMS.</li>
            <li><strong>Sequences</strong> send templated follow-ups automatically and stop when a prospect replies or opts out.</li>
            <li><strong>Needs approval</strong> holds agent/sequence drafts for you to review — price &amp; compliance always need your sign-off.</li>
            <li>Every email has a one-click opt-out; opted-out contacts are suppressed and can&apos;t be messaged again.</li>
          </ul>
        </CollapsibleSection>

        {STAGE_GUIDE.map((s) => (
          <CollapsibleSection key={s.label} title={s.label}>
            <ul className="list-disc space-y-1.5 pl-4 text-sm text-gray-700">
              {s.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </CollapsibleSection>
        ))}
      </div>
    </aside>
  );
}
