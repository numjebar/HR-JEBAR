-- Clear the temporary PIN lock for an employee.
-- Run this in Supabase SQL Editor when a real employee is locked during testing.

delete from public.employee_pin_attempts
where emp_id in (
  select id
  from public.employees
  where name = 'หนุ่ม'
);

