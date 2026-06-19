-- Allow employees to save an ID-card image URL from the profile page.
-- Run after the base employee portal/session RPC files.

create or replace function public.employee_update_profile(
  p_emp_id uuid,
  p_phone text,
  p_id_number text,
  p_id_card_url text,
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
  update public.employees
  set phone = p_phone,
      id_number = p_id_number,
      id_card_url = p_id_card_url,
      bank_name = p_bank_name,
      bank_account = p_bank_account,
      em_name = p_em_name,
      em_rel = p_em_rel,
      em_phone = p_em_phone,
      updated_at = now()
  where id = p_emp_id
  returning *;
$$;

create or replace function public.employee_update_profile_v2(
  p_session_token text,
  p_phone text,
  p_id_number text,
  p_id_card_url text,
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
    p_phone, p_id_number, p_id_card_url, p_bank_name, p_bank_account,
    p_em_name, p_em_rel, p_em_phone
  );
$$;

grant execute on function public.employee_update_profile(uuid, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.employee_update_profile_v2(text, text, text, text, text, text, text, text, text) to anon, authenticated;
