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
- [x] Google Search Console: SET UP 5 Jul. Domain property joincarenow.com verified via DNS TXT (in Vercel — keep it), sitemap.xml submitted, Carer job URL requested for indexing. Google had already discovered the URL via the sitemap (crawlability fix confirmed working).
- [~] SEO pages: BUILT 5 Jul. New routes /features, /pricing (standalone), /guides + two sourced compliance articles (CQC Reg 19, CIW Wales) with Article JSON-LD. Shared marketing chrome (components/marketing/chrome.tsx). Added to sitemap + homepage footer links. Code-only. Needs visual check.
- [ ] Social proof / outcome stat — BLOCKED on Phil: needs real testimonials/stats (won't invent).
- [~] Self-serve signup — DECISION MADE 5 Jul (reverses invite-only rule): free trial + card, light care-provider gate, build now / gate activation behind SELF_SERVE_SIGNUP flag until Ltd + terms live. Plan in PLAN-SELF-SERVE.md.
  - Slice 1 BUILT 5 Jul (flag OFF): mig 0154 self_serve_create_company RPC, lib/flags.ts, /start page + form, selfServeSignUp action, flag-driven "Start free trial" CTA (homepage + chrome, more prominent than demo when on). NEEDS: migration 0154 shipped.
  - Slice 2 TO BUILD (gated): Stripe trial-with-card into the finishing gate + terms/DPA acceptance; /terms page (item 4) is a dependency; flip SELF_SERVE_SIGNUP=true when Ltd + terms live.
- [x] Multi-job-board distribution: Google for Jobs live + submitted to Search Console; Indeed via scraping (crawlable). Aggregator XML feed BUILT 5 Jul (/jobs.xml, Indeed-style, mig 0156 get_public_jobs_feed) for Adzuna/Jooble/Talent.com — register the feed URL with each. Free Indeed XML feeds are dead industry-wide. Per-company opt-out flag honoured (no UI toggle yet).

## Parked by own call
- [ ] Care-jobs board (Phase 2, not until paying customers; GfJ + aggregator feed prerequisites now done)
- [~] Multi-brand generic second brand (Toflo): name chosen, toflo.co.uk bought + pointed to Vercel. Toflo coming-soon + waitlist page BUILT 5 Jul (mig 0158 waitlist table, /toflo page, /api/toflo/waitlist, middleware host rewrite for toflo.* → /toflo). Full brand registry (Phase 1) still parked. TODO: add toflo.co.uk to Vercel project joincarenowpd.
- [x] Reconcile ARCHITECTURE.md — DONE 5 Jul (header + stack table + reconciliation note; local doc).
- [~] Monitoring — DONE 5 Jul (no new service): error alert digest to platform admin. mig 0157 + lib/errors/alert.ts + /api/cron/error-alerts (*/15); recipient = ERROR_ALERT_EMAIL env else platform admin email. Sentry/PostHog optional future.

## To verify
- [ ] Contract PDF auto-filing into employee Documents on hire
- [ ] Whether talent-pool consent exists anywhere not yet found
