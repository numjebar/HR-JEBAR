-- Keep approved leave requests visible in attendance and payroll.
-- Run this once in Supabase SQL Editor.

create or replace function public.sync_approved_leave_to_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date;
begin
  if new.status = 'approved' then
    v_day := new.date_from;
    while v_day <= new.date_to loop
      insert into public.attendance (
        org_id,
        emp_id,
        date,
        clock_in,
        clock_out,
        status,
        ot_min,
        leave_type,
        paid
      )
      values (
        new.org_id,
        new.emp_id,
        v_day,
        null,
        null,
        'leave',
        0,
        new.type,
        true
      )
      on conflict (emp_id, date) do update
      set status = 'leave',
          clock_in = null,
          clock_out = null,
          ot_min = 0,
          leave_type = excluded.leave_type,
          paid = true
      where public.attendance.clock_in is null
         or public.attendance.status = 'leave';

      v_day := v_day + interval '1 day';
    end loop;
  end if;

  if new.status = 'rejected' then
    delete from public.attendance
    where emp_id = new.emp_id
      and date between new.date_from and new.date_to
      and status = 'leave'
      and clock_in is null
      and clock_out is null
      and (leave_type = new.type or leave_type is null);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_approved_leave_to_attendance on public.leaves;

create trigger trg_sync_approved_leave_to_attendance
after insert or update of status, date_from, date_to, type
on public.leaves
for each row
execute function public.sync_approved_leave_to_attendance();

-- Backfill leave requests that were approved before this trigger existed.
update public.leaves
set status = status
where status = 'approved';
