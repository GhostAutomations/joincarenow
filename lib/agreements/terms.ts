// Plan-driven Join Care Now subscription agreement. Plain-English terms a care
// company e-signs during account setup. NOT legal advice — Phil to have this
// reviewed by a solicitor before relying on it.

export const AGREEMENT_VERSION = 2;

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
    `This agreement ("Agreement") is made between Join Care Now ("the Provider", "we", "us", "our") and ${company} ("the Customer", "you", "your"). ` +
    `It sets out the terms on which you may access and use the Join Care Now platform. By accepting this Agreement you agree to be bound by it.\n\n` +

    `1. Definitions\n` +
    `"Platform" means the Join Care Now web application and related services. "Services" means the recruitment, onboarding, compliance, communication and workforce features we make available to you. ` +
    `"Customer Data" means the personal and other data you, your Authorised Users, your candidates and your staff submit to the Platform. ` +
    `"Authorised Users" means the individuals you permit to access the Platform under your account (for example your administrators, managers and recruiters). ` +
    `"Subscription Term" means the period set out in clause 2. "Fees" means the charges payable under clause 4.\n\n` +

    `2. The Services and your plan\n` +
    `Plan: ${p.label}.\n` +
    `Price: ${p.price}.\n` +
    `Term: this subscription runs for ${p.term}.\n` +
    `Set-up: ${p.setup}.\n` +
    `We grant you a non-exclusive, non-transferable right to access and use the Platform for your internal business purposes during the Subscription Term, in accordance with this Agreement.\n\n` +

    `3. What's included\n` +
    `Your plan includes every Join Care Now feature — recruitment, onboarding and compliance (including Right to Work, DBS and references) — together with one branch and 100 SMS messages per month. ` +
    `Additional usage is charged as you grow at: extra branches £7.50 per branch per month; SMS at 8p each after your monthly 100; and AI actions at 10p each. ` +
    `Add-on rates may change on at least 30 days' notice.` +
    offerClause + `\n\n` +

    `4. Fees, payment and price changes\n` +
    `Subscription Fees and any set-up fee are billed in advance through our payment provider (Stripe). Usage-based charges (SMS, AI actions and additional branches) are billed in arrears or as incurred. ` +
    `All Fees are exclusive of VAT, which will be added where applicable. You must keep a valid payment method on file and authorise us to charge it for all Fees as they fall due. ` +
    `If a payment fails or is overdue we may charge interest on overdue sums at 4% per year above the Bank of England base rate and/or suspend access under clause 14 until the account is brought up to date. ` +
    `Except where required by law or expressly stated in this Agreement, Fees are non-refundable, including for partial periods. We may change the recurring Subscription Fee on at least 30 days' notice, effective from your next renewal.\n\n` +

    `5. Term, renewal and cancellation\n` +
    `${p.cancellation} On expiry of any committed term, this Agreement continues on the renewal basis described above unless terminated under clause 15. Cancelling stops future renewals; it does not entitle you to a refund of Fees already paid for the current period.\n\n` +

    `6. Your account and Authorised Users\n` +
    `You are responsible for your account and for all activity under it. You must keep login credentials secure, ensure your Authorised Users comply with this Agreement, and tell us promptly of any unauthorised access. ` +
    `You are responsible for the acts and omissions of your Authorised Users as if they were your own.\n\n` +

    `7. Your obligations\n` +
    `You agree to: use the Platform lawfully and only for its intended purpose; provide accurate information and keep it up to date; obtain all consents and provide all privacy notices required for us to process Customer Data on your behalf; ` +
    `not misuse, copy, resell, reverse-engineer, overload or attempt to disrupt or gain unauthorised access to the Platform; and not upload unlawful, infringing or malicious content. ` +
    `You remain responsible for your own compliance obligations as an employer and care provider, including with the CQC, CIW or other applicable regulators.\n\n` +

    `8. Data protection (UK GDPR)\n` +
    `For Customer Data that is personal data, you are the data controller and we are your data processor. We will process Customer Data only on your documented instructions (this Agreement and your use of the Platform being such instructions) and as required by law. We will: ` +
    `(a) apply appropriate technical and organisational security measures and keep your data logically isolated from other customers; ` +
    `(b) ensure personnel authorised to process Customer Data are bound by confidentiality; ` +
    `(c) engage sub-processors (including our hosting, payment, email, SMS and AI providers) under terms protecting the data, and remain responsible for them; ` +
    `(d) assist you, taking account of the nature of processing, with data subject requests and with your security, breach-notification and impact-assessment obligations; ` +
    `(e) notify you without undue delay on becoming aware of a personal data breach affecting Customer Data; ` +
    `(f) where data is transferred outside the UK, ensure an appropriate safeguard (such as the UK International Data Transfer Agreement or addendum) is in place; and ` +
    `(g) on termination, at your choice, return or delete Customer Data within a reasonable period, save where retention is required by law. ` +
    `You warrant that you have a lawful basis and all necessary consents and notices for the Customer Data you provide. We will not sell Customer Data.\n\n` +

    `9. Confidentiality\n` +
    `Each party will keep confidential the other's non-public information disclosed in connection with this Agreement and use it only to perform this Agreement, except where disclosure is required by law or to professional advisers under a duty of confidence. This clause does not apply to information that is or becomes public through no breach of this Agreement.\n\n` +

    `10. Intellectual property\n` +
    `We and our licensors own all intellectual property rights in the Platform and the Services. We grant you only the access rights expressly set out in this Agreement; no other rights are granted. ` +
    `You own your Customer Data and grant us a licence to host, process and use it to provide and improve the Services and as otherwise permitted by this Agreement. If you give us feedback or suggestions, we may use them without restriction or charge.\n\n` +

    `11. Availability, support and maintenance\n` +
    `We will use reasonable endeavours to make the Platform available and to provide reasonable support during normal UK business hours. We may carry out planned or emergency maintenance and will try to minimise disruption. ` +
    `Unless a separate service-level agreement is signed, the Platform is provided without an uptime guarantee.\n\n` +

    `12. Warranties and disclaimers\n` +
    `We warrant that we will provide the Services with reasonable skill and care. You warrant that you have authority to enter into this Agreement and that your Customer Data and its use comply with applicable law. ` +
    `Except as expressly stated, and to the fullest extent permitted by law, the Platform is provided "as is" and we exclude all other warranties, conditions and terms, whether express or implied. We do not warrant that the Platform will be uninterrupted or error-free.\n\n` +

    `13. Limitation of liability\n` +
    `Nothing in this Agreement limits liability that cannot be limited by law, including for death or personal injury caused by negligence, fraud, or a party's data-protection liability to a data subject. ` +
    `Subject to that, neither party is liable for indirect or consequential loss, or for loss of profit, revenue, data, goodwill or anticipated savings; and our total aggregate liability arising out of or in connection with this Agreement in any 12-month period is limited to the Fees you paid to us in that period.\n\n` +

    `14. Indemnity\n` +
    `You will indemnify us against losses, damages and reasonable costs we incur arising from your breach of clauses 7 (Your obligations) or 8 (Data protection), or from any claim that your Customer Data or its use infringes the rights of, or has caused harm to, a third party.\n\n` +

    `15. Suspension and termination\n` +
    `We may suspend your access if you fail to pay when due, or where we reasonably believe there is a security risk or unlawful use. Either party may terminate this Agreement on written notice if the other materially breaches it and fails to remedy the breach within 30 days of being asked, or becomes insolvent. ` +
    `On termination your right to use the Platform ends, any Fees accrued remain payable, and you may export your Customer Data during a reasonable window after which we may delete it in line with clause 8.\n\n` +

    `16. Force majeure\n` +
    `Neither party is liable for failure or delay caused by events beyond its reasonable control, including outages of third-party infrastructure, telecommunications failures, or acts of government.\n\n` +

    `17. Compliance with laws\n` +
    `Each party will comply with applicable laws in performing this Agreement, including anti-bribery, anti-slavery and data-protection laws.\n\n` +

    `18. General\n` +
    `Assignment: you may not assign or transfer this Agreement without our consent; we may assign it to a group company or successor and may use sub-contractors. ` +
    `Notices: we may give notice by email or in-app; you may contact us by replying to our emails or via the contact details on joincarenow.com. ` +
    `Entire agreement: this Agreement is the whole agreement between the parties on its subject matter and supersedes prior discussions. ` +
    `Variation: we may update these terms from time to time and will give reasonable notice of material changes; continued use after a change takes effect constitutes acceptance. ` +
    `Severability: if any provision is unenforceable, the rest continues in force. No waiver of a breach is a waiver of any later breach. Nothing in this Agreement creates a partnership or agency. ` +
    `A person who is not a party has no rights under the Contracts (Rights of Third Parties) Act 1999.\n\n` +

    `19. Governing law and jurisdiction\n` +
    `This Agreement and any dispute arising out of it are governed by the laws of England and Wales, and the courts of England and Wales have exclusive jurisdiction.\n\n` +

    `Acceptance\n` +
    `By typing your name and ticking the box to agree, you confirm that you have read and accept this Agreement and that you have authority to enter into it on behalf of ${company}.`;

  return { version: AGREEMENT_VERSION, title: "Join Care Now — Subscription Agreement", bodyText: body };
}
