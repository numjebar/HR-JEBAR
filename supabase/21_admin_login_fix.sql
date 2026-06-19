-- Fix admin login when Supabase Auth user exists but admin_roles is missing.
-- Run in Supabase SQL Editor.
--
-- Change v_admin_email if the admin email is different.

do $$
declare
  v_admin_email text := 'je-bar@hotmail.com';
  v_admin_user_id uuid;
  v_org_id uuid;
begin
  select id
    into v_admin_user_id
  from auth.users
  where lower(email) = lower(v_admin_email)
  order by created_at
  limit 1;

  if v_admin_user_id is null then
    raise exception 'Admin auth user not found for email: %', v_admin_email;
  end if;

  select id
    into v_org_id
  from public.orgs
  order by id
  limit 1;

  if v_org_id is null then
    insert into public.orgs (id, name)
    values ('00000000-0000-0000-0000-000000000001', 'JEBAR')
    on conflict (id) do nothing
    returning id into v_org_id;

    if v_org_id is null then
      v_org_id := '00000000-0000-0000-0000-000000000001';
    end if;
  end if;

  insert into public.admin_roles (auth_user_id, org_id)
  values (v_admin_user_id, v_org_id)
  on conflict (auth_user_id, org_id) do nothing;
end;
$$;

-- Verify result.
select
  u.email,
  ar.org_id,
  o.name as org_name
from public.admin_roles ar
join auth.users u on u.id = ar.auth_user_id
join public.orgs o on o.id = ar.org_id
where lower(u.email) = lower('je-bar@hotmail.com');
