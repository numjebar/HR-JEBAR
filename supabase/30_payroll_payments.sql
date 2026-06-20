-- Payroll payments — mark a pay cycle as "paid already"
-- Run this once in Supabase SQL Editor before using the "จ่ายแล้ว" marker in AdminPayroll.
--
-- One row = one employee's pay cycle that the admin has confirmed as paid.
-- Uniqueness is per (emp_id, cycle_from, cycle_to) so re-marking the same cycle
-- updates the existing record instead of duplicating it.

create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  emp_id uuid not null references public.employees(id) on delete cascade,
  period text not null,            -- 'day' | 'week' | 'month'
  cycle_from date not null,
  cycle_to date not null,
  net_amount numeric not null default 0,
  note text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (emp_id, cycle_from, cycle_to)
);

create index if not exists payroll_payments_emp_idx
  on public.payroll_payments(emp_id, cycle_from, cycle_to);

create index if not exists payroll_payments_org_idx
  on public.payroll_payments(org_id, cycle_from, cycle_to);

alter table public.payroll_payments enable row level security;

-- Admins of the org have full access; nobody else can see payroll payments.
drop policy if exists "admin full payroll_payments" on public.payroll_payments;
create policy "admin full payroll_payments"
on public.payroll_payments
for all
using (public.is_admin(org_id))
with check (public.is_admin(org_id));

-- Mark (or re-mark) a cycle as paid. Upserts on the unique cycle key.
create or replace function public.payroll_mark_paid(
  p_emp_id uuid,
  p_period text,
  p_cycle_from date,
  p_cycle_to date,
  p_net_amount numeric default 0,
  p_note text default null
)
returns public.payroll_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
  v_row public.payroll_payments;
begin
  select * into v_emp from public.employees where id = p_emp_id;
  if v_emp.id is null then
    raise exception 'Employee not found';
  end if;

  if not public.is_admin(v_emp.org_id) then
    raise exception 'Not authorized';
  end if;

  insert into public.payroll_payments (
    org_id, emp_id, period, cycle_from, cycle_to, net_amount, note
  )
  values (
    v_emp.org_id, v_emp.id, coalesce(p_period, 'month'),
    p_cycle_from, p_cycle_to, coalesce(p_net_amount, 0), p_note
  )
  on conflict (emp_id, cycle_from, cycle_to)
  do update set
    net_amount = excluded.net_amount,
    period = excluded.period,
    note = excluded.note,
    paid_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

-- Remove the paid marker for a cycle (undo).
create or replace function public.payroll_unmark_paid(
  p_emp_id uuid,
  p_cycle_from date,
  p_cycle_to date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp public.employees;
begin
  select * into v_emp from public.employees where id = p_emp_id;
  if v_emp.id is null then
    raise exception 'Employee not found';
  end if;

  if not public.is_admin(v_emp.org_id) then
    raise exception 'Not authorized';
  end if;

  delete from public.payroll_payments
  where emp_id = p_emp_id
    and cycle_from = p_cycle_from
    and cycle_to = p_cycle_to;
end;
$$;

grant execute on function public.payroll_mark_paid(uuid, text, date, date, numeric, text) to authenticated;
grant execute on function public.payroll_unmark_paid(uuid, date, date) to authenticated;
