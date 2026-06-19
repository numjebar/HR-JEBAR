-- ให้หน้า PIN โหลดรายชื่อพนักงานได้โดยไม่ต้อง login
-- คืนเฉพาะข้อมูลที่จำเป็นสำหรับการเลือกบัญชี ไม่เปิดเผยข้อมูลส่วนตัว/เงินเดือน

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
set search_path = public, auth
as $$
  select e.id, e.name, e.nickname, e.color, e.photo_url, u.email as login_email
  from public.employees e
  join auth.users u on u.id = e.auth_user_id
  where e.auth_user_id is not null
  order by e.name;
$$;

grant execute on function public.employee_login_options() to anon, authenticated;
