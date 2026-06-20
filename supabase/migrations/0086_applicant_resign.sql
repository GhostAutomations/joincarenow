-- ============================================================
-- JOIN CARE NOW — Migration 0086: applicant re-sign
-- Lets an applicant re-sign a document that staff rejected (sign-off). They can
-- update their own signed_documents row (new signature, back to 'pending').
-- Run AFTER 0085_signed_doc_signoff.sql.
-- ============================================================

drop policy if exists signed_documents_update_applicant on public.signed_documents;
create policy signed_documents_update_applicant on public.signed_documents
  for update using (public.is_applicant_owner(applicant_id))
  with check (public.is_applicant_owner(applicant_id));
