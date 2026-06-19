-- Make checkout checklist reliable for production.
-- 1) employee_home_data now returns the latest employee row.
-- 2) employee_clock_out rejects checkout when required closing tasks are incomplete.

create or replace function public.employee_home_data(p_emp_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'employee', public.employee_safe_json(e),
    'branch', to_jsonb(b),
    'settings', to_jsonb(s),
    'today_att', (
      select to_jsonb(a)
      from public.attendance a
      where a.emp_id = e.id and a.date = current_date
      limit 1
    ),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(m) order by m.created_at desc)
      from (
        select *
        from public.messages
        where emp_id = e.id
        order by created_at desc
        limit 30
      ) m
    ), '[]'::jsonb),
    'week_att', coalesce((
      select jsonb_agg(to_jsonb(a))
      from public.attendance a
      where a.emp_id = e.id
        and a.date >= (current_date - ((extract(dow from current_date)::int + 6) % 7))
        and a.date <= (current_date - ((extract(dow from current_date)::int + 6) % 7) + 6)
    ), '[]'::jsonb)
  )
  from public.employees e
  left join public.branches b on b.id = e.branch_id
  left join public.org_settings s on s.org_id = e.org_id
  where e.id = p_emp_id;
$$;

create or replace function public.employee_clock_out(
  p_emp_id uuid,
  p_time text,
  p_ot_min int,
  p_closing_done text[] default '{}'
)
returns setof public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
  v_missing_count int;
  v_att public.attendance;
begin
  select * into v_emp
  from public.employees
  where id = p_emp_id;

  if v_emp.id is null then
    raise exception 'Employee not found';
  end if;

  select count(*)
    into v_missing_count
  from unnest(coalesce(v_emp.closing_tasks, '{}'::text[])) as required_task(task)
  where not required_task.task = any(coalesce(p_closing_done, '{}'::text[]));

  if v_missing_count > 0 then
    raise exception 'กรุณาเช็กรีสให้ครบก่อนลงเวลาออก';
  end if;

  update public.attendance
  set clock_out = p_time,
      ot_min = p_ot_min,
      closing_done = coalesce(p_closing_done, '{}'::text[])
  where emp_id = p_emp_id
    and date = current_date
    and clock_in is not null
  returning * into v_att;

  if v_att.id is null then
    raise exception 'ยังไม่มีเวลาเข้าในวันนี้';
  end if;

  return next v_att;
end;
$$;

grant execute on function public.employee_home_data(uuid) to anon, authenticated;
grant execute on function public.employee_clock_out(uuid, text, int, text[]) to anon, authenticated;

