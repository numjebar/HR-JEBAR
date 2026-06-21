-- 31_leave_quota.sql
-- เพิ่มโควต้าวันลาต่อพนักงาน + RPC สรุปการลาประจำปี

-- 1. เพิ่ม columns ในตาราง employees
alter table public.employees
  add column if not exists annual_leave_days int not null default 6,
  add column if not exists sick_leave_days   int not null default 30;

comment on column public.employees.annual_leave_days is 'จำนวนวันลาพักร้อนที่พนักงานมีสิทธิ์ต่อปี';
comment on column public.employees.sick_leave_days   is 'จำนวนวันลาป่วยที่พนักงานมีสิทธิ์ต่อปี';

-- 2. RPC: ดึงสรุปการลาประจำปีของพนักงาน (ผ่าน session token)
create or replace function public.employee_leave_balance_v2(p_session_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_year   int;
begin
  -- ตรวจสอบ session
  select emp_id into v_emp_id
  from public.employee_sessions
  where session_token = p_session_token
    and expires_at > now()
  limit 1;

  if v_emp_id is null then
    return '{"error":"invalid_session"}'::jsonb;
  end if;

  v_year := extract(year from now());

  return (
    select jsonb_build_object(
      'annual_leave_days', e.annual_leave_days,
      'sick_leave_days',   e.sick_leave_days,
      'year',              v_year,
      -- วันลาพักร้อน: นับจากใบลาที่อนุมัติแล้ว ประจำปีนี้
      'used_annual', coalesce((
        select sum(l.date_to::date - l.date_from::date + 1)
        from public.leaves l
        where l.emp_id = v_emp_id
          and l.type = 'ลาพักร้อน'
          and l.status = 'approved'
          and extract(year from l.date_from) = v_year
      ), 0)::int,
      -- วันลาป่วย
      'used_sick', coalesce((
        select sum(l.date_to::date - l.date_from::date + 1)
        from public.leaves l
        where l.emp_id = v_emp_id
          and l.type = 'ลาป่วย'
          and l.status = 'approved'
          and extract(year from l.date_from) = v_year
      ), 0)::int,
      -- วันลากิจ (ไม่มีโควต้า — แค่นับให้รู้)
      'used_personal', coalesce((
        select sum(l.date_to::date - l.date_from::date + 1)
        from public.leaves l
        where l.emp_id = v_emp_id
          and l.type = 'ลากิจ'
          and l.status = 'approved'
          and extract(year from l.date_from) = v_year
      ), 0)::int
    )
    from public.employees e
    where e.id = v_emp_id
  );
end;
$$;

grant execute on function public.employee_leave_balance_v2(uuid) to anon, authenticated;
