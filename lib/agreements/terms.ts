// Plan-driven Join Care Now subscription agreement. Plain-English terms a care
// company e-signs during account setup. NOT legal advice — Phil to have this
// reviewed by a solicitor before relying on it.

export const AGREEMENT_VERSION = 1;

export type AgreementPlan = "monthly" | "commit" | "annual";

type PlanCopy = {
  label: string;
  price: string;
  term: string;
  setup: string;
  cancellation: string;
};

const PLAN_COPY: Record<AgreementPlan, PlanCopy> = {
  monthly: {
    label: "Monthly (rolling)",
    price: "£55 per month, billed monthly in advance",
    term: "a rolling monthly term that continues until cancelled",
    setup: "a one-off set-up fee of £150 applies",
    cancellation:
      "You may cancel at any time from your billing settings. Cancellation takes effect at the end of the current paid month; the subscription is not refunded for the remainder of that month.",
  },
  commit: {
    label: "12-month plan",
    price: "£55 per month, billed monthly in advance",
    term: "a minimum committed term of 12 months from the start date",
    setup: "no set-up fee applies",
    cancellation:
      "This plan runs for a minimum of 12 months and cannot be cancelled before the end of that term. After the initial 12 months it continues monthly until cancelled.",
  },
  annual: {
    label: "Annual plan",
    price: "£550 per year (equivalent to two months free), billed annually in advance",
    term: "a committed term of 12 months from the start date",
    setup: "no set-up fee applies",
    cancellation:
      "This plan is paid annually in advance and cannot be cancelled mid-term. It renews annually unless you cancel before the renewal date.",
  },
};

/** Build the subscription agreement the customer signs. `plan` defaults to
 *  monthly if none was recorded. `offer` is the optional sweetener agreed on the
 *  sales call (e.g. "3 months free", "+100 SMS/mo", "£45/mo"). */
export function buildSubscriptionTerms(opts: {
  companyName: string;
  plan: AgreementPlan | null;
  offer: string | null;
}): { version: number; title: string; bodyText: string } {
  const plan = (opts.plan ?? "monthly") as AgreementPlan;
  const p = PLAN_COPY[plan];
  const company = opts.companyName?.trim() || "the Customer";
  const offerClause = opts.offer?.trim()
    ? `\n\nAgreed concession\nAs agreed during onboarding, the following has been applied to your account: ${opts.offer.trim()}. Where a concession changes the price or allowances above, the concession takes precedence for the period it applies.`
    : "";

  const body =
    `Join Care Now — Subscription Agreement\n\n` +
    `This agreement is between Join Care Now ("the Provider", "we", "us") and ${company} ("the Customer", "you"). ` +
    `It sets out the terms on which you may use the Join Care Now platform.\n\n` +

    `1. Your plan\n` +
    `Plan: ${p.label}.\n` +
    `Price: ${p.price}.\n` +
    `Term: This subscription runs for ${p.term}.\n` +
    `Set-up: ${p.setup}.\n\n` +

    `2. What's included\n` +
    `Your plan includes every Join Care Now feature — recruitment, onboarding and compliance (including Right to Work, DBS and references) — together with one branch and 100 SMS messages per month. ` +
    `Additional usage is charged as you grow at: extra branches £7.50 per branch per month; SMS at 8p each after your monthly 100; and AI actions at 10p each. ` +
    `Add-on rates may change on 30 days' notice.` +
    offerClause + `\n\n` +

    `3. Payment\n` +
    `Subscription fees and any set-up fee are billed in advance through our payment provider (Stripe). ` +
    `Usage-based charges (SMS, AI actions and additional branches) are billed in arrears or as incurred. ` +
    `If a payment fails we may suspend access until the account is brought up to date.\n\n` +

    `4. Cancellation and term\n` +
    `${p.cancellation}\n\n` +

    `5. Your data and GDPR\n` +
    `You remain the data controller for the personal data you and your candidates and staff put into the platform. ` +
    `We act as your data processor and process that data only to provide the service, in line with UK GDPR and the Data Protection Act 2018. ` +
    `We apply appropriate technical and organisational security measures, keep your company's data isolated from other customers, and will not sell your data. ` +
    `On termination we will, on request, return or delete your data within a reasonable period, subject to any legal retention obligations.\n\n` +

    `6. Acceptable use\n` +
    `You agree to use the platform lawfully, to keep your login credentials secure, and not to misuse, copy or attempt to disrupt the service. ` +
    `You are responsible for the accuracy of the information you enter and for obtaining the appropriate consents from your applicants and staff.\n\n` +

    `7. Availability and support\n` +
    `We aim to provide a reliable, available service and reasonable support, but the platform is provided on an "as is" basis without uptime guarantees unless separately agreed in writing.\n\n` +

    `8. Liability\n` +
    `Nothing in this agreement limits liability that cannot be limited by law. Subject to that, our total liability to you in any 12-month period is limited to the fees you paid in that period. ` +
    `We are not liable for indirect or consequential loss, or loss of profit, data or goodwill.\n\n` +

    `9. Changes to these terms\n` +
    `We may update these terms from time to time and will give you reasonable notice of material changes. Continued use after a change takes effect constitutes acceptance.\n\n` +

    `10. Governing law\n` +
    `This agreement is governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction.\n\n` +

    `Acceptance\n` +
    `By typing your name and ticking the box to agree, you confirm that you have read and accept these terms and that you have authority to enter into this agreement on behalf of ${company}.`;

  return { version: AGREEMENT_VERSION, title: "Join Care Now — Subscription Agreement", bodyText: body };
}
