-- Production layer for employee PIN login.
-- Employees receive a random session token after PIN login. Every employee RPC
-- must validate that token before returning or changing data.

create extension if not exists pgcrypto;

create table if not exists public.employee_sessions (
  id uuid primary key default gen_random_uuid(),
  emp_id uuid not null references public.employees(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists employee_sessions_emp_id_idx on public.employee_sessions(emp_id);
create index if not exists employee_sessions_expires_at_idx on public.employee_sessions(expires_at);

alter table public.employee_sessions enable row level security;

create or replace function public.employee_session_emp_id(p_session_token text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select s.emp_id
  from public.employee_sessions s
  where p_session_token is not null
    and s.expires_at > now()
    and s.token_hash = extensions.crypt(p_session_token, s.token_hash)
  order by s.created_at desc
  limit 1;
$$;

create or replace function public.employee_safe_json(p_emp public.employees)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(p_emp) - 'pin_hash';
$$;

create or replace function public.employee_pin_login_session(p_emp_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
  v_token text;
begin
  select * into v_emp
  from public.employees e
  where e.id = p_emp_id
    and e.pin_hash is not null
    and e.pin_hash = extensions.crypt(p_pin, e.pin_hash);

  if v_emp.id is null then
    return null;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.employee_sessions (emp_id, token_hash)
  values (v_emp.id, extensions.crypt(v_token, extensions.gen_salt('bf')));

  return jsonb_build_object(
    'employee', public.employee_safe_json(v_emp),
    'session_token', v_token,
    'expires_at', (now() + interval '14 days')
  );
end;
$$;

create or replace function public.employee_current_session(p_session_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.employee_safe_json(e)
  from public.employees e
  where e.id = public.employee_session_emp_id(p_session_token);
$$;

create or replace function public.employee_logout_session(p_session_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.employee_sessions s
  where s.token_hash = extensions.crypt(p_session_token, s.token_hash);
$$;

create or replace function public.employee_home_data_v2(p_session_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.employee_home_data(public.employee_session_emp_id(p_session_token));
$$;

create or replace function public.employee_history_data_v2(p_session_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.employee_history_data(public.employee_session_emp_id(p_session_token));
$$;

create or replace function public.employee_pay_data_v2(p_session_token text, p_from date, p_to date)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.employee_pay_data(public.employee_session_emp_id(p_session_token), p_from, p_to);
$$;

create or replace function public.employee_profile_data_v2(p_session_token text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select public.employee_profile_data(public.employee_session_emp_id(p_session_token));
$$;

create or replace function public.employee_update_profile_v2(
  p_session_token text,
  p_phone text,
  p_id_number text,
  p_bank_name text,
  p_bank_account text,
  p_em_name text,
  p_em_rel text,
  p_em_phone text
)
returns setof public.employees
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_update_profile(
    public.employee_session_emp_id(p_session_token),
    p_phone, p_id_number, p_bank_name, p_bank_account,
    p_em_name, p_em_rel, p_em_phone
  );
$$;

create or replace function public.employee_get_messages_v2(p_session_token text)
returns setof public.messages
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_get_messages(public.employee_session_emp_id(p_session_token));
$$;

create or replace function public.employee_mark_admin_messages_read_v2(p_session_token text)
returns void
language sql
security definer
set search_path = public
as $$
  select public.employee_mark_admin_messages_read(public.employee_session_emp_id(p_session_token));
$$;

create or replace function public.employee_send_message_v2(p_session_token text, p_text text)
returns public.messages
language sql
security definer
set search_path = public
as $$
  select public.employee_send_message(public.employee_session_emp_id(p_session_token), p_text);
$$;

create or replace function public.employee_mark_task_done_v2(p_session_token text, p_msg_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  select public.employee_mark_task_done(public.employee_session_emp_id(p_session_token), p_msg_id);
$$;

create or replace function public.employee_request_leave_v2(
  p_session_token text,
  p_type text,
  p_date_from date,
  p_date_to date,
  p_reason text,
  p_urgent boolean,
  p_deduct_amount numeric default 0,
  p_deduct_note text default null
)
returns setof public.leaves
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_request_leave(
    public.employee_session_emp_id(p_session_token),
    p_type, p_date_from, p_date_to, p_reason,
    p_urgent, p_deduct_amount, p_deduct_note
  );
$$;

create or replace function public.employee_clock_in_v2(
  p_session_token text,
  p_time text,
  p_status attendance_status_enum,
  p_selfie_url text default null,
  p_dist int default null,
  p_lat double precision default null,
  p_lng double precision default null
)
returns setof public.attendance
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_clock_in(
    public.employee_session_emp_id(p_session_token),
    p_time, p_status, p_selfie_url, p_dist, p_lat, p_lng
  );
$$;

create or replace function public.employee_clock_out_v2(
  p_session_token text,
  p_time text,
  p_ot_min int,
  p_closing_done text[] default '{}'
)
returns setof public.attendance
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_clock_out(
    public.employee_session_emp_id(p_session_token),
    p_time, p_ot_min, p_closing_done
  );
$$;

grant execute on function public.employee_pin_login_session(uuid, text) to anon, authenticated;
grant execute on function public.employee_current_session(text) to anon, authenticated;
grant execute on function public.employee_logout_session(text) to anon, authenticated;
grant execute on function public.employee_home_data_v2(text) to anon, authenticated;
grant execute on function public.employee_history_data_v2(text) to anon, authenticated;
grant execute on function public.employee_pay_data_v2(text, date, date) to anon, authenticated;
grant execute on function public.employee_profile_data_v2(text) to anon, authenticated;
grant execute on function public.employee_update_profile_v2(text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.employee_get_messages_v2(text) to anon, authenticated;
grant execute on function public.employee_mark_admin_messages_read_v2(text) to anon, authenticated;
grant execute on function public.employee_send_message_v2(text, text) to anon, authenticated;
grant execute on function public.employee_mark_task_done_v2(text, uuid) to anon, authenticated;
grant execute on function public.employee_request_leave_v2(text, text, date, date, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.employee_clock_in_v2(text, text, attendance_status_enum, text, int, double precision, double precision) to anon, authenticated;
grant execute on function public.employee_clock_out_v2(text, text, int, text[]) to anon, authenticated;

-- Remove public access from test-only employee RPCs that trust emp_id directly.
revoke execute on function public.employee_pin_login(uuid, text) from public, anon, authenticated;
revoke execute on function public.employee_home_data(uuid) from public, anon, authenticated;
revoke execute on function public.employee_history_data(uuid) from public, anon, authenticated;
revoke execute on function public.employee_pay_data(uuid, date, date) from public, anon, authenticated;
revoke execute on function public.employee_profile_data(uuid) from public, anon, authenticated;
revoke execute on function public.employee_update_profile(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.employee_get_messages(uuid) from public, anon, authenticated;
revoke execute on function public.employee_mark_admin_messages_read(uuid) from public, anon, authenticated;
revoke execute on function public.employee_send_message(uuid, text) from public, anon, authenticated;
revoke execute on function public.employee_mark_task_done(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.employee_request_leave(uuid, text, date, date, text, boolean, numeric, text) from public, anon, authenticated;
revoke execute on function public.employee_clock_in(uuid, text, attendance_status_enum, text, int, double precision, double precision) from public, anon, authenticated;
revoke execute on function public.employee_clock_out(uuid, text, int, text[]) from public, anon, authenticated;
