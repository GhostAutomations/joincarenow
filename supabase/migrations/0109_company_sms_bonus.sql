-- Extra monthly SMS allowance granted as a sales concession (e.g. "+100 SMS/mo").
-- Added on top of the standard 100 included before metered SMS is charged.
alter table public.companies add column if not exists sms_bonus int not null default 0;
