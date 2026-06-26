-- ============================================================
-- JOIN CARE NOW — Migration 0121: more form field types
-- Brings the form builder to parity with Monday.com's field set. Adds:
--   time      — time of day (HH:MM)
--   date_range — a from→to date pair
--   rating    — a 1–5 star rating
--   country   — a country dropdown
--   link      — a URL field
-- (We already have short/long text, number, email, phone, address/location,
--  dropdown/radio/checkboxes (single/multi select), yes_no (true/false), file,
--  signature, date, month, branch, role, transport, page break, info text.)
-- Run AFTER 0120_portal_interview_opening_hours.sql.
-- ============================================================

alter type public.form_field_type add value if not exists 'time';
alter type public.form_field_type add value if not exists 'date_range';
alter type public.form_field_type add value if not exists 'rating';
alter type public.form_field_type add value if not exists 'country';
alter type public.form_field_type add value if not exists 'link';
