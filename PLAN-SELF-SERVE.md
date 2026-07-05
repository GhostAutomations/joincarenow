# Self-serve signup — plan

**Decision (5 Jul 2026):** reverse the invite-only / founder-led rule and add public
self-serve company signup. Locked choices:

- **Model:** free trial, **card required** (Stripe, auto-converts at trial end).
- **Who:** open self-serve but with a **light care-provider gate** (ask a provider reference,
  e.g. company number or CQC/CIW registration, no manual approval).
- **Go-live:** **build now, gate activation behind a flag** (`SELF_SERVE_SIGNUP`) until the Ltd is
  formed and the item-4 terms/DPA are live. The prominent "Start free trial" CTA is flag-driven, so
  it only appears once the flow can legally complete.

## Why gated
A self-serve customer accepts the terms/DPA and pays with no human in the loop. Until the company
exists and those documents are live, the contract would be in Phil's personal name and the DPA they
accept would not exist — which undercuts the "all liability on the company from day 1" goal.

## Slice 1 — signup flow (built 5 Jul, flag OFF)
- **Migration `self_serve_create_company`** (SECURITY DEFINER): creates the company AND links the
  signing-up user as its admin in one step (the founder path splits these across an invite). Guarded:
  caller must be signed in and not already belong to a company.
- **`SELF_SERVE_SIGNUP` flag** (`lib/flags.ts`, reads env). OFF = `/start` redirects to the demo and
  the marketing CTA stays "Book a demo". ON = `/start` live and "Start free trial" becomes the
  primary CTA.
- **`selfServeSignUp` action:** validate, create the admin auth user (mirrors applicant signUp),
  create the company + admin link via the RPC, capture the provider reference, seed the starter pack,
  land them in the existing setup/billing gate.
- **`/start` page:** company name, provider reference, admin name/email/password, accept-terms.
- **Marketing CTA:** flag-driven "Start free trial" made more prominent than "Book a demo".

## Slice 2 — activation (gated, build later)
- Stripe Checkout **trial-with-card** wired into the finishing gate; auto-convert at trial end.
- **Terms + DPA acceptance** captured at signup (needs item-4 docs live).
- Flip `SELF_SERVE_SIGNUP=true` once the Ltd and terms are in place.

## Notes / open
- Abuse: email confirmation + card (Slice 2) are the real gates; the provider reference is a light
  filter only, not verified.
- The founder-led creation path stays for hand-held onboarding; self-serve is additive.
