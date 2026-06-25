-- Carry the employment type chosen on the offer onto the employee record at
-- hire. A BEFORE INSERT trigger covers every hire path (token accept, manual
-- hire) without rewriting the employee-creation function. Only fills it if not
-- already set, so manual edits aren't overwritten.
create or replace function public._employee_set_employment_type()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.employment_type is null and new.application_id is not null then
    select employment_type into new.employment_type
    from public.offers
    where application_id = new.application_id and employment_type is not null
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_employee_employment_type on public.employees;
create trigger trg_employee_employment_type
  before insert on public.employees
  for each row execute function public._employee_set_employment_type();
