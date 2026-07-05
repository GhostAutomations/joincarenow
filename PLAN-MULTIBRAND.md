# Multi-Brand Plan: Generic Platform on a Second Domain

**Decisions locked (4 Jul 2026):** one codebase + brand registry · shared Supabase DB with a brand column · care features flagged per brand · brand name TBC (Phil has one in mind — check domain availability before purchase).

**Model:** two brands, one product. Join Care Now stays care-specialised on www.joincarenow.com. The new brand is the sector-neutral face of the same platform on its own domain. Same Vercel project serves both domains; the request hostname decides which brand the visitor sees. One repo, one migration stream, one founder console.

---

## What the codebase survey found (4 Jul 2026)

- **185 occurrences of "Join Care Now" / joincarenow.com across 84 files** — emails, marketing pages, privacy/terms, agreement text, ICS invites, JSON-LD, sidebar/topbar, auth cards.
- **`BASE_URL = "https://www.joincarenow.com"` hardcoded as a local const in 8+ modules** (offers, references, interviews, applications, prospects ×2, sequences) plus exported from `lib/billing/stripe.ts` and reused by Ruby conversations and billing admin actions. All links in outbound email/SMS come from these.
- **Email template is already half-ready:** `renderEmailHtml` takes `logoUrl`/`brandColor`/`heading` per company — only its *defaults* are JCN (navy #0d1d4b, "Join Care Now" heading).
- **Middleware does no host routing** — just Supabase session update. Host-based brand resolution is a clean addition.
- **Per-company branding already exists** (colours + logo → `--brand-*` CSS vars), so tenant-level theming needs no change; this plan adds a *platform-brand* layer above it.
- Care-specific surface: CQC/CIW + Reg 73/80 reports, care terminology (Registered Individual/Manager), care/office role tagging, Carer.Academy + becarecompliant integrations, starter pack content, Form Store templates, all marketing copy, subscription agreement text.

---

## Phase 0 — Name, domain, accounts (Phil + Claude, before any code)

1. Phil gives the brand name → check domain availability + price (Vercel tool) → **Phil purchases**.
2. Add domain to Vercel project `joincarenowpd` (both apex → www redirect, matching JCN convention).
3. Resend: add + verify the new domain (DKIM/SPF/DMARC), decide from-address (e.g. recruitment@newdomain).
4. Supabase Auth: add the new domain to redirect URL allowlist.
5. No new Stripe account — same account, same prices to start (pricing display is brand copy, not new products).

## Phase 1 — Brand registry foundation (slice 1, code + 1 migration)

- `lib/brand/registry.ts` (plain lib, not "use server"): a `Brand` record per brand keyed by id — name, canonical domain, tagline, logo component/asset, colours, RESEND from-address, from-name, feature flags, terminology map, footer/legal identity. JCN entry reproduces today's values exactly.
- `resolveBrand()` server helper: hostname → brand (fallback JCN). Client access via a small context/provider fed from the server layout.
- `brandBaseUrl(brand)` replaces every hardcoded `BASE_URL` const — **links in emails must use the company's brand domain, not the request's**, so all senders resolve brand from the company record, not the host.
- **Migration NNNN:** `brands` lookup table + `companies.brand_id` (default and backfill `jcn`). RLS untouched — brand is a partition of companies, tenant isolation already holds.
- Founder console: brand picker on company create; brand shown in companies list.

## Phase 2 — De-hardcode the 84 files (slice 2, code-only, mechanical)

- Sweep all "Join Care Now" strings and joincarenow.com URLs → brand registry lookups. Priorities: email senders (`lib/comms/*`), offers/references/interviews/applications actions, ICS calendar, agreement/terms (`lib/agreements/terms.ts` — legal identity per brand), privacy page, auth cards, sidebar/topbar/logo (`components/brand/`), starter pack copy.
- Founder-facing and prospect-CRM strings stay JCN where they genuinely are JCN business (sales CRM sells both brands later; out of scope now).
- Verification: repo-wide grep must show remaining "Join Care Now" strings only inside the JCN brand registry entry, JCN-only marketing content and docs.

## Phase 3 — Host-aware marketing + public pages (slice 3, code-only)

- Middleware: rewrite `/` (and marketing routes) by hostname to per-brand marketing pages. App/dashboard routes are brand-agnostic (they render from the company's brand). Careers pages already company-branded; they gain correct canonical domain from the company's brand.
- New generic homepage + pricing copy (sector-neutral: "recruitment and onboarding platform" not "care sector"). Reuses the existing marketing components; navy+gold stays unless you want a distinct palette.
- Per-host `robots.ts`, `sitemap.ts`, Google for Jobs JSON-LD URLs (already helper-based in `lib/seo/job-posting.ts` — point at brand domain).
- Privacy policy + subscription agreement rendered per brand (same processor terms, different brand identity). GDPR note: controller/processor roles unchanged; only the brand identity in the documents changes.

## Phase 4 — Feature flags + terminology (slice 4, code-only)

Flags in the brand registry, checked where the feature surfaces:

| Area | JCN | Generic |
|---|---|---|
| CQC/CIW compliance reports incl. Reg 73/80 | on | off (recruitment reports remain) |
| Carer.Academy + becarecompliant integrations | on | off |
| Role labels (Registered Individual/Manager) | care terms | neutral terms (e.g. Director / Hiring Manager) via terminology map — same role levels, same permissions, labels only |
| Care/office role tagging + starter pack content | care variant | generic variant |
| Form Store | care templates | curate a generic set (existing `is_store` machinery; add brand visibility column if needed — would be a second migration, decide in slice) |

## Phase 5 — Ops, billing surface, QA (slice 5)

- Webhooks: Stripe/Twilio/Resend endpoints are shared and already in PUBLIC_PATHS — no change; verify success/cancel URLs use brand domain.
- Founder console: per-brand stats and MRR split; sales inbound (sales@) per domain later if wanted.
- Cron jobs (reminders, expire-jobs) are brand-agnostic — verify emails they send resolve brand from the company.
- QA checklist (Tuesday session, popup format): both homepages render on the right domains; a generic-brand company gets generic emails/links/logo end to end (invite → apply → interview → offer → hire); JCN companies unchanged; care flags hidden on generic; sitemaps/robots per host; Stripe checkout round-trips on the new domain.

## Explicitly out of scope (ask before starting)

Separate Stripe products/pricing per brand · per-brand Form Store curation content · white-label (customer-branded domains) beyond this two-brand registry · sales CRM multi-brand · new palette for the generic brand.

## Risks

- **Email links crossing brands** — the reason `brandBaseUrl` keys off the *company*, not the request host. Test explicitly.
- **Static rendering of marketing routes** — per-host rewrite must not let Next cache one brand's homepage for the other; per-brand routes (not one route with host logic) avoid this.
- **Missed strings** — 185 occurrences is sweepable but the grep-verification step in Phase 2 is the safety net.

## Sequencing

Phase 0 (Phil: name + purchase) → slice 1 (registry + migration NNNN → **ship**) → slices 2–5 (code-only → git push each). Each slice independently deployable; JCN behaviour unchanged until the new domain is attached.
