-- Admin PIN recovery for production use.
-- Adds two admin-only RPCs:
-- 1) admin_set_employee_pin: reset a forgotten PIN and clear lock/session state.
-- 2) admin_unlock_employee_pin: clear temporary PIN lock without changing the PIN.

create extension if not exists pgcrypto;

create or replace function public.admin_set_employee_pin(p_emp_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select org_id into v_org_id
  from public.employees
  where id = p_emp_id;

  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  if not public.is_admin(v_org_id) then
    raise exception 'Not allowed';
  end if;

  update public.employees
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_emp_id;

  delete from public.employee_pin_attempts
  where emp_id = p_emp_id;

  delete from public.employee_sessions
  where emp_id = p_emp_id;

  perform public.log_audit_event(
    v_org_id,
    p_emp_id,
    'admin',
    'employee_pin_reset',
    '{}'::jsonb
  );
end;
$$;

create or replace function public.admin_unlock_employee_pin(p_emp_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select org_id into v_org_id
  from public.employees
  where id = p_emp_id;

  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  if not public.is_admin(v_org_id) then
    raise exception 'Not allowed';
  end if;

  delete from public.employee_pin_attempts
  where emp_id = p_emp_id;

  perform public.log_audit_event(
    v_org_id,
    p_emp_id,
    'admin',
    'employee_pin_unlocked',
    '{}'::jsonb
  );
end;
$$;

grant execute on function public.admin_set_employee_pin(uuid, text) to authenticated;
grant execute on function public.admin_unlock_employee_pin(uuid) to authenticated;

