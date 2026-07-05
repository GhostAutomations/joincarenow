# Join Care Now — Running Backlog

Excludes testing and Carer.Academy integration. Last reviewed 5 Jul 2026.

## Half-built, needs finishing
- [x] Talent pool consent capture: already built (migs 0071/0081, applicants.talent_pool + talent_pool_consent_at).
- [~] Talent pool 6-month auto-purge cron: BUILT 5 Jul (lib/comms/talent-pool-purge.ts + /api/cron/talent-pool, daily 04:00). Warns ~14 days before expiry with a re-consent button, then purges dormant retained applications and clears expired consent. Code-only, no migration. Needs Tuesday testing.
- [ ] Contracts Slice 3: sealed PDF + audit trail (who/when/IP) auto-filed into employee Documents on hire. On-demand render route exists; verify filing-on-hire path.
- [ ] Branding: settings-side brand colour/logo editing + brand-themed careers pages. Currently deferred.

## Regulatory / legal (mostly paperwork)
- [ ] ICO registration + fee
- [ ] Finalise privacy policy (real legal name + ICO reference)
- [ ] Cookie / PECR consent
- [ ] Customer DPA (Art. 28)
- [ ] Sub-processor list, ROPA, retention policy
- [ ] DSAR process, breach procedure, DPIA
- [ ] DBS certificate handling policy
- [ ] Website terms of use + acceptable use policy
- [ ] Real company details in footer

## GDPR product features (not built)
- [ ] SAR export
- [ ] Anonymisation
- [ ] Retention / deletion jobs

## Go-to-market
- [ ] SEO pages (/features, CQC/Reg 19 articles)
- [ ] Social proof / outcome stat
- [ ] Self-serve signup decision
- [ ] Multi-job-board / Indeed distribution (biggest product gap)

## Parked by own call
- [ ] Care-jobs board (Phase 2, not until paying customers + Google for Jobs live)
- [ ] Multi-brand generic second brand (plan banked; staying on JCN for now)
- [ ] Reconcile ARCHITECTURE.md with real stack + add monitoring (Sentry/PostHog)

## To verify
- [ ] Contract PDF auto-filing into employee Documents on hire
- [ ] Whether talent-pool consent exists anywhere not yet found
