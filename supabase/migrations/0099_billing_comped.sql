-- ============================================================
-- JOIN CARE NOW — Migration 0099: complimentary (comped) billing
-- Lets the founder give a company free access without a Stripe subscription.
-- Run AFTER 0098_commitment.sql.
-- ============================================================

alter table public.companies
  add column if not exists billing_comped boolean not null default false;
