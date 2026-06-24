-- Track how much of a company's monthly SMS bonus (sms_bonus, a sales
-- concession) has been used this calendar month. Stripe's tiered price gives the
-- first 100 SMS free per period; the bonus is granted by withholding the first
-- `sms_bonus` SMS each month from the metered report, so we count what's used.
alter table public.companies add column if not exists sms_bonus_used int not null default 0;
alter table public.companies add column if not exists sms_bonus_month text; -- 'YYYY-MM'
