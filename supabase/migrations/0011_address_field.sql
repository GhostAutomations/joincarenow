-- ============================================================
-- JOIN CARE NOW — Migration 0011: Address field type
-- A structured address field (line 1/2, town, county, postcode).
-- Run AFTER 0010_form_store.sql.
-- ============================================================

alter type public.form_field_type add value if not exists 'address';
