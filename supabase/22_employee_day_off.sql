-- Add/fix per-employee regular day off.
-- Run in Supabase SQL Editor before using the new day-off picker.
--
-- Values:
-- 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday,
-- 4 = Thursday, 5 = Friday, 6 = Saturday.
--
-- This script is safe to run again. It also fixes an older accidental
-- jsonb day_off column by converting it to int[] without USING subqueries.

do $$
declare
  v_udt_name text;
begin
  select udt_name
    into v_udt_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'employees'
    and column_name = 'day_off';

  if v_udt_name is null then
    alter table public.employees
      add column day_off int[] not null default '{}';

  elsif v_udt_name = 'jsonb' then
    alter table public.employees
      drop constraint if exists employees_day_off_valid;

    alter table public.employees
      add column if not exists day_off_int int[] not null default '{}';

    update public.employees
    set day_off_int = case
      when day_off is null then '{}'::int[]
      when jsonb_typeof(day_off) = 'array' then
        coalesce(
          (
            select array_agg(item.value_text::int order by item.value_text::int)
            from jsonb_array_elements_text(day_off) as item(value_text)
            where item.value_text ~ '^[0-6]$'
          ),
          '{}'::int[]
        )
      else '{}'::int[]
    end;

    alter table public.employees
      drop column day_off;

    alter table public.employees
      rename column day_off_int to day_off;

  elsif v_udt_name <> '_int4' then
    raise exception 'Unsupported employees.day_off type: %', v_udt_name;
  end if;
end;
$$;

alter table public.employees
  drop constraint if exists employees_day_off_valid;

update public.employees
set day_off = '{}'
where day_off is null;

alter table public.employees
  alter column day_off set default '{}',
  alter column day_off set not null;

alter table public.employees
  add constraint employees_day_off_valid
  check (
    day_off is not null
    and day_off <@ array[0, 1, 2, 3, 4, 5, 6]::int[]
  );
