-- ═══════════════════════════════════════════════════════════════
-- HR JEBAR — Payroll Sync RPC for JE BAR Operate
-- รันใน Supabase SQL Editor ครั้งเดียว
--
-- ฟังก์ชันนี้ให้ JE BAR Operate ดึงสรุปวันทำงานต่อเดือน
-- ผ่าน anon key ได้โดยตรง (SECURITY DEFINER บายพาส RLS)
-- ข้อมูลที่คืน: ชื่อพนักงาน + จำนวนวันทำงาน เท่านั้น
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_payroll_month_summary(p_year int, p_month int)
RETURNS TABLE (
  emp_name     text,
  daily_rate   numeric,
  days_present int,
  days_late    int,
  days_paid_leave int,
  days_worked  int   -- วันที่ได้รับค่าจ้าง = present + late + paid leave
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.name                                                                       AS emp_name,
    e.rate                                                                       AS daily_rate,
    COUNT(CASE WHEN a.status = 'present'  AND a.paid = true THEN 1 END)::int   AS days_present,
    COUNT(CASE WHEN a.status = 'late'     AND a.paid = true THEN 1 END)::int   AS days_late,
    COUNT(CASE WHEN a.status = 'leave'    AND a.paid = true THEN 1 END)::int   AS days_paid_leave,
    COUNT(CASE WHEN a.status IN ('present','late','leave') AND a.paid = true THEN 1 END)::int AS days_worked
  FROM employees e
  LEFT JOIN attendance a
    ON  a.emp_id = e.id
    AND EXTRACT(YEAR  FROM a.date) = p_year
    AND EXTRACT(MONTH FROM a.date) = p_month
  GROUP BY e.id, e.name, e.rate
  ORDER BY e.name;
$$;

-- อนุญาตให้ anon key เรียกใช้ได้ (Operate ใช้ anon key)
GRANT EXECUTE ON FUNCTION get_payroll_month_summary(int, int) TO anon, authenticated;
