-- ============================================================
-- JOIN CARE NOW — Migration 0092: prospect unsubscribe token
-- Gives each prospect contact a token for one-click email unsubscribe. Run
-- AFTER 0091_prospect_crm.sql.
-- ============================================================

alter table public.prospect_contacts
  add column if not exists unsub_token uuid not null default gen_random_uuid();

create unique index if not exists idx_prospect_contacts_unsub on public.prospect_contacts (unsub_token);
