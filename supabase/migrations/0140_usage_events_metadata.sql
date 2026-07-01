-- ============================================================
-- JOIN CARE NOW — Migration 0140: usage event metadata
-- Adds WHAT (label) and WHO (actor_id) to billable usage events so the founder
-- can drill into a company's AI/SMS usage ("what was it used for") if a client
-- queries it. Historical rows have null label/actor (shown as "—"). No PII is
-- stored here — SMS events carry a reason label only, never recipient/content.
-- Run AFTER 0097_billing.sql.
-- ============================================================

alter table public.usage_events add column if not exists label text;
alter table public.usage_events add column if not exists actor_id uuid;
