-- ============================================================
-- JOIN CARE NOW — Migration 0145: allow "signature not required" on documents
-- A contract or policy can be set so applicants just read it (no signature). Add
-- 'none' to the allowed signature_method values. Run AFTER 0144.
-- ============================================================

alter table public.contract_templates drop constraint if exists contract_templates_signature_method_check;
alter table public.contract_templates
  add constraint contract_templates_signature_method_check
  check (signature_method = any (array['type'::text, 'draw'::text, 'none'::text]));

alter table public.policy_documents drop constraint if exists policy_documents_signature_method_check;
alter table public.policy_documents
  add constraint policy_documents_signature_method_check
  check (signature_method = any (array['type'::text, 'draw'::text, 'none'::text]));
