-- ============================================================
-- JOIN CARE NOW — Migration 0058: month/year field type
-- A date field that captures month + year only (HTML month picker).
-- ADD VALUE auto-commits and can't run in a transaction with its first use,
-- so it lives in its own migration. Run AFTER 0057_referees_from_form.sql.
-- ============================================================

alter type public.form_field_type add value if not exists 'month';
