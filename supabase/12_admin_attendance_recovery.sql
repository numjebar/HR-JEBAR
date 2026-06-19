-- Admin attendance recovery tools.
-- Lets admins clear a clock-out or delete one attendance row from the app.

create or replace function public.admin_clear_clock_out(p_attendance_id uuid)
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
  set clock_out = null,
      ot_min = 0,
      closing_done = null
  where id = p_attendance_id;

  perform public.log_audit_event(
    v_att.org_id,
    v_att.emp_id,
    'admin',
    'attendance_clock_out_cleared',
    jsonb_build_object('attendance_id', p_attendance_id, 'old_clock_out', v_att.clock_out)
  );
end;
$$;

create or replace function public.admin_delete_attendance(p_attendance_id uuid)
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
    return;
  end if;

  if not public.is_admin(v_att.org_id) then
    raise exception 'Not allowed';
  end if;

  delete from public.attendance
  where id = p_attendance_id;

  perform public.log_audit_event(
    v_att.org_id,
    v_att.emp_id,
    'admin',
    'attendance_deleted',
    jsonb_build_object('attendance_id', p_attendance_id, 'date', v_att.date)
  );
end;
$$;

grant execute on function public.admin_clear_clock_out(uuid) to authenticated;
grant execute on function public.admin_delete_attendance(uuid) to authenticated;

