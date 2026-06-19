-- RPC ครบชุดสำหรับฝั่งพนักงานที่ login ด้วย PIN local

create or replace function public.employee_home_data(p_emp_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
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

create or replace function public.employee_history_data(p_emp_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(a) order by a.date desc)
      from (
        select *
        from public.attendance
        where emp_id = e.id
        order by date desc
        limit 60
      ) a
    ), '[]'::jsonb),
    'leaves', coalesce((
      select jsonb_agg(to_jsonb(l) order by l.created_at desc)
      from public.leaves l
      where l.emp_id = e.id
    ), '[]'::jsonb),
    'branch', to_jsonb(b),
    'settings', to_jsonb(s)
  )
  from public.employees e
  left join public.branches b on b.id = e.branch_id
  left join public.org_settings s on s.org_id = e.org_id
  where e.id = p_emp_id;
$$;

create or replace function public.employee_pay_data(p_emp_id uuid, p_from date, p_to date)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'branch', to_jsonb(b),
    'settings', to_jsonb(s),
    'attendance', coalesce((
      select jsonb_agg(to_jsonb(a))
      from public.attendance a
      where a.emp_id = e.id and a.date >= p_from and a.date <= p_to
    ), '[]'::jsonb),
    'sales', coalesce((
      select jsonb_agg(to_jsonb(x))
      from public.sales x
      where x.emp_id = e.id and x.date >= p_from and x.date <= p_to
    ), '[]'::jsonb),
    'adjustments', coalesce((
      select jsonb_agg(to_jsonb(d))
      from public.adjustments d
      where d.emp_id = e.id and d.date >= p_from and d.date <= p_to
    ), '[]'::jsonb)
  )
  from public.employees e
  left join public.branches b on b.id = e.branch_id
  left join public.org_settings s on s.org_id = e.org_id
  where e.id = p_emp_id;
$$;

create or replace function public.employee_profile_data(p_emp_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'branch', to_jsonb(b),
    'settings', to_jsonb(s)
  )
  from public.employees e
  left join public.branches b on b.id = e.branch_id
  left join public.org_settings s on s.org_id = e.org_id
  where e.id = p_emp_id;
$$;

create or replace function public.employee_update_profile(
  p_emp_id uuid,
  p_phone text,
  p_id_number text,
  p_bank_name text,
  p_bank_account text,
  p_em_name text,
  p_em_rel text,
  p_em_phone text
)
returns setof public.employees
language sql
security definer
set search_path = public
as $$
  update public.employees
  set phone = p_phone,
      id_number = p_id_number,
      bank_name = p_bank_name,
      bank_account = p_bank_account,
      em_name = p_em_name,
      em_rel = p_em_rel,
      em_phone = p_em_phone,
      updated_at = now()
  where id = p_emp_id
  returning *;
$$;

create or replace function public.employee_request_leave(
  p_emp_id uuid,
  p_type text,
  p_date_from date,
  p_date_to date,
  p_reason text,
  p_urgent boolean,
  p_deduct_amount numeric default 0,
  p_deduct_note text default null
)
returns setof public.leaves
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_leave public.leaves;
begin
  select org_id into v_org_id from public.employees where id = p_emp_id;
  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  insert into public.leaves (emp_id, org_id, type, date_from, date_to, reason, status, urgent)
  values (p_emp_id, v_org_id, p_type, p_date_from, p_date_to, p_reason, 'pending', p_urgent)
  returning * into v_leave;

  if p_urgent and p_deduct_amount > 0 then
    insert into public.adjustments (emp_id, org_id, date, type, amount, note, auto)
    values (p_emp_id, v_org_id, current_date, 'other', p_deduct_amount, coalesce(p_deduct_note, 'ลาด่วน'), true);
  end if;

  return next v_leave;
end;
$$;

create or replace function public.employee_clock_in(
  p_emp_id uuid,
  p_time text,
  p_status attendance_status_enum,
  p_selfie_url text default null,
  p_dist int default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns setof public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_att public.attendance;
begin
  select org_id into v_org_id from public.employees where id = p_emp_id;
  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  insert into public.attendance (
    emp_id, org_id, date, clock_in, status,
    checkin_selfie_url, checkin_dist, checkin_lat, checkin_lng
  )
  values (p_emp_id, v_org_id, current_date, p_time, p_status, p_selfie_url, p_dist, p_lat, p_lng)
  on conflict (emp_id, date) do update
  set clock_in = excluded.clock_in,
      status = excluded.status,
      checkin_selfie_url = excluded.checkin_selfie_url,
      checkin_dist = excluded.checkin_dist,
      checkin_lat = excluded.checkin_lat,
      checkin_lng = excluded.checkin_lng
  returning * into v_att;

  return next v_att;
end;
$$;

create or replace function public.employee_clock_out(
  p_emp_id uuid,
  p_time text,
  p_ot_min int,
  p_closing_done text[] default '{}'
)
returns setof public.attendance
language sql
security definer
set search_path = public
as $$
  update public.attendance
  set clock_out = p_time,
      ot_min = p_ot_min,
      closing_done = p_closing_done
  where emp_id = p_emp_id
    and date = current_date
  returning *;
$$;

grant execute on function public.employee_home_data(uuid) to anon, authenticated;
grant execute on function public.employee_history_data(uuid) to anon, authenticated;
grant execute on function public.employee_pay_data(uuid, date, date) to anon, authenticated;
grant execute on function public.employee_profile_data(uuid) to anon, authenticated;
grant execute on function public.employee_update_profile(uuid, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.employee_request_leave(uuid, text, date, date, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.employee_clock_in(uuid, text, attendance_status_enum, text, int, double precision, double precision) to anon, authenticated;
grant execute on function public.employee_clock_out(uuid, text, int, text[]) to anon, authenticated;
