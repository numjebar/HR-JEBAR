-- Fix employee_send_message_v2 audit logging.
-- The previous version selected the whole composite return value as one field.

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

  select org_id into v_org_id
  from public.employees
  where id = v_emp_id;

  select *
    into v_msg
  from public.employee_send_message(v_emp_id, p_text);

  perform public.log_audit_event(
    v_org_id,
    v_emp_id,
    'employee',
    'message_sent',
    jsonb_build_object('message_id', v_msg.id)
  );

  return v_msg;
end;
$$;

grant execute on function public.employee_send_message_v2(text, text) to anon, authenticated;
