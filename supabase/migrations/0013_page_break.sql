-- ============================================================
-- JOIN CARE NOW — Migration 0013: Page break element
-- Lets a form be split into pages. Run AFTER 0012_field_logic.sql.
-- ============================================================

alter type public.form_field_type add value if not exists 'page_break';
