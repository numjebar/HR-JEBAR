-- Employee PIN login list for local PIN accounts.
-- New employee accounts no longer need Supabase Auth users.

create or replace function public.employee_login_options()
returns table (
  id uuid,
  name text,
  nickname text,
  color text,
  photo_url text,
  login_email text
)
language sql
security definer
set search_path = public
as $$
  select e.id, e.name, e.nickname, e.color, e.photo_url, null::text as login_email
  from public.employees e
  where e.pin_hash is not null
  order by e.name;
$$;

grant execute on function public.employee_login_options() to anon, authenticated;

