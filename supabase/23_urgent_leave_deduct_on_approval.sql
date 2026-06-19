-- Urgent leave should be deducted only after admin approval,
-- not immediately when the employee submits the leave request.

create or replace function public.employee_request_leave(
  p_emp_id uuid,
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
  v_org_id uuid;
  v_leave public.leaves;
begin
  select org_id into v_org_id from public.employees where id = p_emp_id;
  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  insert into public.leaves (emp_id, org_id, type, date_from, date_to, reason, status, urgent)
  values (p_emp_id, v_org_id, p_type, p_date_from, p_date_to, p_reason, 'pending', p_urgent)
  returning * into v_leave;

  return next v_leave;
end;
$$;

