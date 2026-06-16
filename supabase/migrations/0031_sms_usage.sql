-- ============================================================
-- JOIN CARE NOW — Migration 0031: SMS usage (founder)
-- Platform-admin-only view of outbound SMS volume per company,
-- this calendar month and all-time. Reads the messages log, so it
-- works even though every company shares one Twilio number.
-- Run AFTER 0030_interviewer.sql.
-- ============================================================

create or replace function public.get_sms_usage()
returns table (
  company_id uuid,
  company_name text,
  sms_this_month bigint,
  sms_total bigint
)
language sql security definer stable set search_path = public
as $$
  select c.id, c.name,
         count(m.id) filter (
           where m.created_at >= date_trunc('month', now() at time zone 'utc')
         ),
         count(m.id)
  from public.companies c
  left join public.messages m
    on m.company_id = c.id and m.channel = 'sms' and m.direction = 'outbound'
  where public.is_platform_admin()
  group by c.id, c.name
  order by 3 desc, c.name;
$$;
