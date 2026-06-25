-- Applicant-side messaging: a 'portal' channel for in-app replies, and RLS so
-- an applicant can read their own conversation (email/sms/portal — NOT internal
-- notes) and post portal replies on their own application.

alter table public.messages drop constraint if exists messages_channel_check;
alter table public.messages add constraint messages_channel_check
  check (channel in ('email', 'sms', 'note', 'portal'));

drop policy if exists messages_select_applicant on public.messages;
create policy messages_select_applicant on public.messages
  for select using (public.is_applicant_owner(applicant_id) and channel <> 'note');

drop policy if exists messages_insert_applicant on public.messages;
create policy messages_insert_applicant on public.messages
  for insert with check (
    direction = 'inbound' and channel = 'portal' and public.is_applicant_owner(applicant_id)
  );
