-- ============================================================
-- JOIN CARE NOW — Migration 0085: sign-off of signed documents
-- Adds a staff review state to signed contracts/policies so a team member can
-- check the signature is genuine (a real typed name, not an "X" or gibberish)
-- and sign it off — or reject it for re-signing. Run AFTER 0084_reminder_log.sql.
-- ============================================================

alter table public.signed_documents
  add column if not exists review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reject_reason text;

create index if not exists idx_signed_documents_review
  on public.signed_documents (company_id, review_status);

-- Company members can sign off / reject (update the review state).
drop policy if exists signed_documents_update_company on public.signed_documents;
create policy signed_documents_update_company on public.signed_documents
  for update using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));
