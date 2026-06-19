alter table public.employees
  add column if not exists weekly_cycle_start_day integer,
  add column if not exists monthly_cycle_start_day integer;

update public.employees
set
  weekly_cycle_start_day = coalesce(weekly_cycle_start_day, extract(dow from start_date)::int),
  monthly_cycle_start_day = coalesce(monthly_cycle_start_day, extract(day from start_date)::int)
where start_date is not null;

alter table public.employees
  drop constraint if exists employees_weekly_cycle_start_day_check;

alter table public.employees
  add constraint employees_weekly_cycle_start_day_check
  check (
    weekly_cycle_start_day is null
    or weekly_cycle_start_day between 0 and 6
  );

alter table public.employees
  drop constraint if exists employees_monthly_cycle_start_day_check;

alter table public.employees
  add constraint employees_monthly_cycle_start_day_check
  check (
    monthly_cycle_start_day is null
    or monthly_cycle_start_day between 1 and 31
  );
