-- ให้แอดมินรีเซ็ต PIN พนักงานจากหน้า Employees ได้
-- ฟังก์ชันนี้เช็กสิทธิ์แอดมินของ org ก่อน แล้วอัปเดตรหัสผ่านใน Supabase Auth

create extension if not exists pgcrypto;

create or replace function public.reset_employee_pin(p_emp_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org_id uuid;
  v_auth_user_id uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select e.org_id, e.auth_user_id
    into v_org_id, v_auth_user_id
  from public.employees e
  where e.id = p_emp_id;

  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  if not public.is_admin(v_org_id) then
    raise exception 'Not allowed';
  end if;

  if v_auth_user_id is null then
    raise exception 'Employee has no auth account';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = v_auth_user_id;
end;
$$;

grant execute on function public.reset_employee_pin(uuid, text) to authenticated;
