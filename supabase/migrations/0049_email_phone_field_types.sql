-- ============================================================
-- JOIN CARE NOW — Migration 0049: email + phone field types
-- New form-builder field types: a validated Email (local part + provider) and
-- an international Phone number (country dial code + number, stored E.164).
-- ADD VALUE auto-commits and cannot run inside a transaction.
-- Run AFTER 0048_referencing.sql.
-- ============================================================

alter type public.form_field_type add value if not exists 'email';
alter type public.form_field_type add value if not exists 'phone';
