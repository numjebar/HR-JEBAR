-- Test helper: give employee "กก" checkout checklist and clear today's clock-out.
-- Run this once, then refresh the employee page and try checkout again.

update public.employees
set closing_tasks = array[
  'ปิดเครื่องคิดเงิน',
  'เช็กเงินสดในลิ้นชัก',
  'ปิดไฟหน้าร้าน'
],
updated_at = now()
where name = 'กก';

update public.attendance a
set clock_out = null,
    ot_min = 0,
    closing_done = null
from public.employees e
where a.emp_id = e.id
  and e.name = 'กก'
  and a.date = current_date;

