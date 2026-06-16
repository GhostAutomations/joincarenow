-- ============================================================
-- JOIN CARE NOW — Migration 0035: managed-option form fields
-- Three new form-field types whose options are resolved at render time:
--   branch     → the company's Branches list (Settings)
--   role       → the company's Roles list (Settings)
--   transport  → fixed Driver / Walker
-- Enum values can't be added inside a transaction with other uses, so each is
-- its own statement and idempotent.
-- ============================================================

alter type public.form_field_type add value if not exists 'branch';
alter type public.form_field_type add value if not exists 'role';
alter type public.form_field_type add value if not exists 'transport';
