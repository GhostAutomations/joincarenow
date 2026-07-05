# Join Care Now — Running Backlog

Excludes testing and Carer.Academy integration. Last reviewed 5 Jul 2026.

## Half-built, needs finishing
- [x] Talent pool consent capture: already built (migs 0071/0081, applicants.talent_pool + talent_pool_consent_at).
- [~] Talent pool 6-month auto-purge cron: BUILT 5 Jul (lib/comms/talent-pool-purge.ts + /api/cron/talent-pool, daily 04:00). Warns ~14 days before expiry with a re-consent button, then purges dormant retained applications and clears expired consent. Code-only, no migration. Needs Tuesday testing.
- [~] Contracts Slice 3 (sealed PDF filed to employee Documents): BUILT 5 Jul. lib/documents/file-signed-docs.ts + signature/audit block in lib/pdf/document-pdf.ts. On hire (and on post-hire sign-off) each staff-approved signed contract/policy is rendered to a sealed PDF with an audit trail (signer, London date/time, IP, version) and stored in the employee's Documents (hr-documents bucket + employee_documents row). Idempotent, best-effort. Code-only, no migration. Needs Tuesday testing.
- [ ] Contracts Slice 3: sealed PDF + audit trail (who/when/IP) auto-filed into employee Documents on hire. On-demand render route exists; verify filing-on-hire path.
- [x] Branding: settings-side brand editing + themed careers pages. Careers pages were already themed (BrandStyle + careers RPC read settings.brand). 5 Jul: added a Branding section to company Settings (existing BrandingForm) so admins can edit logo + colours themselves. Save flows to dashboard, emails and careers. Code-only, no migration.

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

## GDPR product features
- [~] SAR export: BUILT 5 Jul. exportApplicantData + DataPrivacyActions (Talent Pool page). One-click ZIP of data.json + files for a subject. Company-scoped, audited.
- [~] Erasure (right to be forgotten): BUILT 5 Jul. Hard delete chosen over anonymisation. mig 0153 erase_applicant_at_company (company-scoped, shared profile only removed if orphaned) + eraseApplicant action (deletes storage + orphaned auth user). Admin-only, confirm dialog.
- [~] Retention / deletion jobs: BUILT 5 Jul. lib/privacy/retention.ts + /api/cron/retention (daily 04:30). Per-company Settings → Data & privacy (unsuccessful applicants after N months, leavers after N years). OFF by default. Reuses the erase RPC.
- [ ] Anonymisation: NOT built. Deliberately skipped (chose hard delete). Revisit if reports need to survive erasure.
- NEEDS: migration 0153 shipped; Tuesday testing (destructive — test on a throwaway applicant).

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
