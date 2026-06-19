-- Production hardening: audit log + PIN throttling.

create extension if not exists pgcrypto;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  emp_id uuid references public.employees(id) on delete set null,
  actor text not null default 'system',
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_org_created_idx on public.audit_events(org_id, created_at desc);
create index if not exists audit_events_emp_created_idx on public.audit_events(emp_id, created_at desc);

alter table public.audit_events enable row level security;

drop policy if exists "admin read audit events" on public.audit_events;
create policy "admin read audit events" on public.audit_events for select
  using (public.is_admin(org_id));

create table if not exists public.employee_pin_attempts (
  emp_id uuid primary key references public.employees(id) on delete cascade,
  failed_count int not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.employee_pin_attempts enable row level security;

create or replace function public.log_audit_event(
  p_org_id uuid,
  p_emp_id uuid,
  p_actor text,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.audit_events (org_id, emp_id, actor, action, details)
  values (p_org_id, p_emp_id, coalesce(p_actor, 'system'), p_action, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function public.employee_pin_login_session(p_emp_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
  v_attempt public.employee_pin_attempts;
  v_token text;
  v_locked_until timestamptz;
begin
  select * into v_emp
  from public.employees
  where id = p_emp_id;

  if v_emp.id is null then
    return null;
  end if;

  select * into v_attempt
  from public.employee_pin_attempts
  where emp_id = p_emp_id;

  if v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    perform public.log_audit_event(v_emp.org_id, v_emp.id, 'employee', 'pin_login_locked', jsonb_build_object('locked_until', v_attempt.locked_until));
    raise exception 'PIN ถูกล็อกชั่วคราว กรุณาลองใหม่หลัง %', to_char(v_attempt.locked_until, 'HH24:MI');
  end if;

  if v_emp.pin_hash is null or v_emp.pin_hash <> extensions.crypt(p_pin, v_emp.pin_hash) then
    insert into public.employee_pin_attempts (emp_id, failed_count, last_failed_at, updated_at)
    values (p_emp_id, 1, now(), now())
    on conflict (emp_id) do update
    set failed_count = case
          when public.employee_pin_attempts.last_failed_at is null
            or public.employee_pin_attempts.last_failed_at < now() - interval '15 minutes'
          then 1
          else public.employee_pin_attempts.failed_count + 1
        end,
        last_failed_at = now(),
        locked_until = case
          when (
            case
              when public.employee_pin_attempts.last_failed_at is null
                or public.employee_pin_attempts.last_failed_at < now() - interval '15 minutes'
              then 1
              else public.employee_pin_attempts.failed_count + 1
            end
          ) >= 5 then now() + interval '10 minutes'
          else public.employee_pin_attempts.locked_until
        end,
        updated_at = now()
    returning locked_until into v_locked_until;

    perform public.log_audit_event(v_emp.org_id, v_emp.id, 'employee', 'pin_login_failed', jsonb_build_object('locked_until', v_locked_until));

    if v_locked_until is not null and v_locked_until > now() then
      raise exception 'PIN ผิดหลายครั้ง บัญชีถูกล็อกถึง %', to_char(v_locked_until, 'HH24:MI');
    end if;

    return null;
  end if;

  delete from public.employee_pin_attempts where emp_id = p_emp_id;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  insert into public.employee_sessions (emp_id, token_hash)
  values (v_emp.id, extensions.crypt(v_token, extensions.gen_salt('bf')));

  perform public.log_audit_event(v_emp.org_id, v_emp.id, 'employee', 'pin_login_success', '{}'::jsonb);

  return jsonb_build_object(
    'employee', public.employee_safe_json(v_emp),
    'session_token', v_token,
    'expires_at', (now() + interval '14 days')
  );
end;
$$;

create or replace function public.employee_logout_session(p_session_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_org_id uuid;
begin
  v_emp_id := public.employee_session_emp_id(p_session_token);
  select org_id into v_org_id from public.employees where id = v_emp_id;

  delete from public.employee_sessions s
  where s.token_hash = extensions.crypt(p_session_token, s.token_hash);

  if v_emp_id is not null then
    perform public.log_audit_event(v_org_id, v_emp_id, 'employee', 'logout', '{}'::jsonb);
  end if;
end;
$$;

create or replace function public.employee_send_message_v2(p_session_token text, p_text text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_org_id uuid;
  v_msg public.messages;
begin
  v_emp_id := public.employee_session_emp_id(p_session_token);
  if v_emp_id is null then
    raise exception 'Invalid employee session';
  end if;
  select org_id into v_org_id from public.employees where id = v_emp_id;

  select *
    into v_msg
  from public.employee_send_message(v_emp_id, p_text);

  perform public.log_audit_event(v_org_id, v_emp_id, 'employee', 'message_sent', jsonb_build_object('message_id', v_msg.id));
  return v_msg;
end;
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_org_id uuid;
  v_leave public.leaves;
begin
  v_emp_id := public.employee_session_emp_id(p_session_token);
  select org_id into v_org_id from public.employees where id = v_emp_id;

  select * into v_leave
  from public.employee_request_leave(v_emp_id, p_type, p_date_from, p_date_to, p_reason, p_urgent, p_deduct_amount, p_deduct_note)
  limit 1;

  perform public.log_audit_event(v_org_id, v_emp_id, 'employee', 'leave_requested', jsonb_build_object('leave_id', v_leave.id, 'date_from', p_date_from, 'date_to', p_date_to));
  return next v_leave;
end;
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
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_org_id uuid;
  v_att public.attendance;
begin
  v_emp_id := public.employee_session_emp_id(p_session_token);
  select org_id into v_org_id from public.employees where id = v_emp_id;

  select * into v_att
  from public.employee_clock_in(v_emp_id, p_time, p_status, p_selfie_url, p_dist, p_lat, p_lng)
  limit 1;

  perform public.log_audit_event(v_org_id, v_emp_id, 'employee', 'clock_in', jsonb_build_object('attendance_id', v_att.id, 'time', p_time, 'status', p_status));
  return next v_att;
end;
$$;

create or replace function public.employee_clock_out_v2(
  p_session_token text,
  p_time text,
  p_ot_min int,
  p_closing_done text[] default '{}'
)
returns setof public.attendance
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp_id uuid;
  v_org_id uuid;
  v_att public.attendance;
begin
  v_emp_id := public.employee_session_emp_id(p_session_token);
  select org_id into v_org_id from public.employees where id = v_emp_id;

  select * into v_att
  from public.employee_clock_out(v_emp_id, p_time, p_ot_min, p_closing_done)
  limit 1;

  perform public.log_audit_event(v_org_id, v_emp_id, 'employee', 'clock_out', jsonb_build_object('attendance_id', v_att.id, 'time', p_time, 'ot_min', p_ot_min));
  return next v_att;
end;
$$;

grant execute on function public.log_audit_event(uuid, uuid, text, text, jsonb) to authenticated;
grant execute on function public.employee_pin_login_session(uuid, text) to anon, authenticated;
grant execute on function public.employee_logout_session(text) to anon, authenticated;
grant execute on function public.employee_send_message_v2(text, text) to anon, authenticated;
grant execute on function public.employee_request_leave_v2(text, text, date, date, text, boolean, numeric, text) to anon, authenticated;
grant execute on function public.employee_clock_in_v2(text, text, attendance_status_enum, text, int, double precision, double precision) to anon, authenticated;
grant execute on function public.employee_clock_out_v2(text, text, int, text[]) to anon, authenticated;
