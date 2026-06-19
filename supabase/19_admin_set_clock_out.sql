-- Admin tool: manually set a forgotten clock-out time and keep an audit trail.
-- Run this once in Supabase SQL Editor.

create or replace function public.admin_set_clock_out(
  p_attendance_id uuid,
  p_clock_out text,
  p_ot_min int default 0,
  p_reason text default 'พนักงานลืมเช็คเอาท์'
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
  set clock_out = p_clock_out,
      ot_min = greatest(coalesce(p_ot_min, 0), 0)
  where id = p_attendance_id;

  perform public.log_audit_event(
    v_att.org_id,
    v_att.emp_id,
    'admin',
    'attendance_clock_out_set',
    jsonb_build_object(
      'attendance_id', p_attendance_id,
      'date', v_att.date,
      'old_clock_out', v_att.clock_out,
      'new_clock_out', p_clock_out,
      'old_ot_min', v_att.ot_min,
      'new_ot_min', greatest(coalesce(p_ot_min, 0), 0),
      'reason', p_reason
    )
  );
end;
$$;

grant execute on function public.admin_set_clock_out(uuid, text, int, text) to authenticated;
