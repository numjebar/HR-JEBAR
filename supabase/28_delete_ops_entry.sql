-- Allow an employee to delete their OWN ops entry (e.g. wrong production/cake-stock record).
-- Run this once in Supabase SQL Editor.

create or replace function public.employee_delete_ops_entry(
  p_emp_id uuid,
  p_entry_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry public.employee_ops_entries;
begin
  select *
  into v_entry
  from public.employee_ops_entries
  where id = p_entry_id;

  if v_entry.id is null then
    raise exception 'Entry not found';
  end if;

  -- An employee may only delete entries they submitted themselves.
  if v_entry.emp_id <> p_emp_id then
    raise exception 'Not allowed to delete this entry';
  end if;

  delete from public.employee_ops_entries
  where id = p_entry_id;

  perform public.log_audit_event(
    v_entry.org_id,
    p_emp_id,
    'employee',
    'employee_ops_entry_deleted',
    jsonb_build_object(
      'entry_id', v_entry.id,
      'task_key', v_entry.task_key,
      'branch_id', v_entry.branch_id,
      'payload_preview', v_entry.payload
    )
  );

  return true;
end;
$$;

create or replace function public.employee_delete_ops_entry_v2(
  p_session_token text,
  p_entry_id uuid
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.employee_delete_ops_entry(
    public.employee_session_emp_id(p_session_token),
    p_entry_id
  );
$$;

grant execute on function public.employee_delete_ops_entry(uuid, uuid) to authenticated;
grant execute on function public.employee_delete_ops_entry_v2(text, uuid) to anon, authenticated;
