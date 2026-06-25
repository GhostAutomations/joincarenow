-- Employment type (captured in recruitment) + leaver details on the employee
-- record. 'left' already exists in the employee_status enum (migration 0018);
-- these columns capture the why/when so leavers drop out of active reports.
alter table public.employees add column if not exists employment_type text;          -- full_time | part_time | student_20
alter table public.employees add column if not exists left_at timestamptz;
alter table public.employees add column if not exists last_working_day date;
alter table public.employees add column if not exists leaving_reason text;
alter table public.employees add column if not exists leaving_reason_detail text;

-- Carry employment type from the offer/hire too.
alter table public.offers add column if not exists employment_type text;
