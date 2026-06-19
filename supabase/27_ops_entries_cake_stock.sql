-- Add cake-stock to allowed OPS task keys
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION public.employee_submit_ops_entry(
  p_emp_id uuid,
  p_task_key text,
  p_payload jsonb
)
RETURNS public.employee_ops_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp public.employees;
  v_entry public.employee_ops_entries;
  v_task_key text := lower(trim(coalesce(p_task_key, '')));
  v_payload jsonb := coalesce(p_payload, '{}'::jsonb);
BEGIN
  IF v_task_key NOT IN ('bills', 'production', 'inventory', 'cake-stock', 'supplies-count', 'purchase-list') THEN
    RAISE EXCEPTION 'Unsupported task key: %', p_task_key;
  END IF;

  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_emp_id;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  INSERT INTO public.employee_ops_entries (
    org_id,
    emp_id,
    branch_id,
    task_key,
    payload,
    image_name
  )
  VALUES (
    v_emp.org_id,
    v_emp.id,
    v_emp.branch_id,
    v_task_key,
    v_payload,
    nullif(trim(v_payload->>'imageName'), '')
  )
  RETURNING * INTO v_entry;

  PERFORM public.log_audit_event(
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

  RETURN v_entry;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_submit_ops_entry(uuid, text, jsonb) TO authenticated;
