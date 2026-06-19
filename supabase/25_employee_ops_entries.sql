-- Employee OPS entries
-- Run this once in Supabase SQL Editor before using employee OPS backend save.

create table if not exists public.employee_ops_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  emp_id uuid not null references public.employees(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  task_key text not null,
  payload jsonb not null default '{}'::jsonb,
  image_name text,
  source text not null default 'hr_employee_app',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists employee_ops_entries_emp_id_idx
  on public.employee_ops_entries(emp_id, created_at desc);

create index if not exists employee_ops_entries_task_key_idx
  on public.employee_ops_entries(task_key, created_at desc);

alter table public.employee_ops_entries enable row level security;

drop policy if exists "admin full employee_ops_entries" on public.employee_ops_entries;
create policy "admin full employee_ops_entries"
on public.employee_ops_entries
for all
using (public.is_admin(org_id))
with check (public.is_admin(org_id));

drop policy if exists "emp read own employee_ops_entries" on public.employee_ops_entries;
create policy "emp read own employee_ops_entries"
on public.employee_ops_entries
for select
using (emp_id = public.my_emp_id());

drop policy if exists "emp insert own employee_ops_entries" on public.employee_ops_entries;
create policy "emp insert own employee_ops_entries"
on public.employee_ops_entries
for insert
with check (emp_id = public.my_emp_id());

create or replace function public.employee_submit_ops_entry(
  p_emp_id uuid,
  p_task_key text,
  p_payload jsonb
)
returns public.employee_ops_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
  v_entry public.employee_ops_entries;
  v_task_key text := lower(trim(coalesce(p_task_key, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
begin
  if v_task_key not in ('bills', 'production', 'inventory', 'supplies-count', 'purchase-list') then
    raise exception 'Unsupported task key: %', p_task_key;
  end if;

  select *
  into v_emp
  from public.employees
  where id = p_emp_id;

  if v_emp.id is null then
    raise exception 'Employee not found';
  end if;

  insert into public.employee_ops_entries (
    org_id,
    emp_id,
    branch_id,
    task_key,
    payload,
    image_name
  )
  values (
    v_emp.org_id,
    v_emp.id,
    v_emp.branch_id,
    v_task_key,
    v_payload,
    nullif(trim(v_payload->>'imageName'), '')
  )
  returning * into v_entry;

  perform public.log_audit_event(
    v_emp.org_id,
    v_emp.id,
    'employee',
    'employee_ops_entry_submitted',
    jsonb_build_object(
      'entry_id', v_entry.id,
      'task_key', v_task_key,
      'branch_id', v_emp.branch_id,
      'payload_preview', v_payload
    )
  );

  return v_entry;
end;
$$;

create or replace function public.employee_get_ops_entries(
  p_emp_id uuid,
  p_task_key text default null,
  p_limit int default 8
)
returns setof public.employee_ops_entries
language sql
security definer
set search_path = public
as $$
  select e.*
  from public.employee_ops_entries e
  where e.emp_id = p_emp_id
    and (
      nullif(trim(coalesce(p_task_key, '')), '') is null
      or e.task_key = lower(trim(p_task_key))
    )
  order by e.created_at desc
  limit greatest(coalesce(p_limit, 8), 1);
$$;

create or replace function public.employee_submit_ops_entry_v2(
  p_session_token text,
  p_task_key text,
  p_payload jsonb
)
returns public.employee_ops_entries
language sql
security definer
set search_path = public
as $$
  select public.employee_submit_ops_entry(
    public.employee_session_emp_id(p_session_token),
    p_task_key,
    p_payload
  );
$$;

create or replace function public.employee_get_ops_entries_v2(
  p_session_token text,
  p_task_key text default null,
  p_limit int default 8
)
returns setof public.employee_ops_entries
language sql
security definer
set search_path = public
as $$
  select *
  from public.employee_get_ops_entries(
    public.employee_session_emp_id(p_session_token),
    p_task_key,
    p_limit
  );
$$;

grant execute on function public.employee_submit_ops_entry(uuid, text, jsonb) to authenticated;
grant execute on function public.employee_get_ops_entries(uuid, text, int) to authenticated;
grant execute on function public.employee_submit_ops_entry_v2(text, text, jsonb) to anon, authenticated;
grant execute on function public.employee_get_ops_entries_v2(text, text, int) to anon, authenticated;
