-- Add weekly pay type and admin manual clock-in edit tool.
-- Run this once in Supabase SQL Editor.

do $$
begin
  alter type public.pay_type_enum add value if not exists 'weekly';
exception
  when duplicate_object then null;
end $$;

create or replace function public.admin_set_clock_in(
  p_attendance_id uuid,
  p_clock_in text,
  p_status public.attendance_status_enum default 'present',
  p_reason text default 'แอดมินแก้เวลาเข้างานย้อนหลัง'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_att public.attendance;
begin
  select * into v_att
  from public.attendance
  where id = p_attendance_id;

  if v_att.id is null then
    raise exception 'Attendance not found';
  end if;

  if not public.is_admin(v_att.org_id) then
    raise exception 'Not allowed';
  end if;

  update public.attendance
  set clock_in = p_clock_in,
      status = coalesce(p_status, 'present')
  where id = p_attendance_id;

  perform public.log_audit_event(
    v_att.org_id,
    v_att.emp_id,
    'admin',
    'attendance_clock_in_set',
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'date', v_att.date,
      'old_clock_in', v_att.clock_in,
      'new_clock_in', p_clock_in,
      'old_status', v_att.status,
      'new_status', coalesce(p_status, 'present'),
      'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.admin_set_clock_in(uuid, text, public.attendance_status_enum, text) to authenticated;
