-- RPC สำหรับข้อความฝั่งพนักงานที่ login ด้วย PIN local
-- ใช้เฉพาะข้อมูลของ emp_id ที่ส่งเข้ามา เพื่อให้หน้า employee อ่าน/ส่งข้อความได้แม้ไม่มี Supabase Auth session

create or replace function public.employee_get_messages(p_emp_id uuid)
returns setof public.messages
language sql
security definer
set search_path = public
as $$
  select *
  from public.messages
  where emp_id = p_emp_id
  order by created_at asc;
$$;

create or replace function public.employee_mark_admin_messages_read(p_emp_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
  set status = 'read',
      read_at = now()
  where emp_id = p_emp_id
    and "from" = 'admin'
    and status = 'unread';
$$;

create or replace function public.employee_send_message(p_emp_id uuid, p_text text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_msg public.messages;
begin
  if length(trim(coalesce(p_text, ''))) = 0 then
    raise exception 'Message is required';
  end if;

  select org_id into v_org_id
  from public.employees
  where id = p_emp_id;

  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  insert into public.messages (emp_id, org_id, "from", kind, text, status)
  values (p_emp_id, v_org_id, 'emp', 'message', trim(p_text), 'unread')
  returning * into v_msg;

  return v_msg;
end;
$$;

create or replace function public.employee_mark_task_done(p_emp_id uuid, p_msg_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages
  set status = 'done'
  where id = p_msg_id
    and emp_id = p_emp_id
    and "from" = 'admin'
    and kind = 'task';
$$;

grant execute on function public.employee_get_messages(uuid) to anon, authenticated;
grant execute on function public.employee_mark_admin_messages_read(uuid) to anon, authenticated;
grant execute on function public.employee_send_message(uuid, text) to anon, authenticated;
grant execute on function public.employee_mark_task_done(uuid, uuid) to anon, authenticated;
