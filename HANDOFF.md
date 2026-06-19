# HR JEBAR Handoff

## Update 2026-06-19 (weekly/monthly payroll screen alignment)

- Fixed employee payroll screens so they no longer let a weekly-paid employee drift into a monthly payroll view.
- Fixed admin employee payroll detail so the displayed cycle always matches the employee pay type:
  - `daily` -> day view allowed
  - `weekly` -> week cycle only
  - `monthly` -> month cycle only
- Added clearer labels on both employee/admin screens:
  - current payroll cycle date range
  - weekly employees = current weekly cycle only
  - monthly employees = current monthly cycle only
  - day wage is always shown as `บาท/วัน`
- Build checked successfully after patch:
  - `npm.cmd run build`

### Files touched in this update

- `app/src/pages/employee/EmpPay.jsx`
- `app/src/pages/admin/AdminEmployees.jsx`

อัปเดตล่าสุด: 2026-06-18

## Update 2026-06-18 (payroll cycle clarification)

- ปรับ logic ใหม่ให้ `pay_type` หมายถึง "รอบจ่ายเงิน" เท่านั้น
  - `daily` = จ่ายรายวัน
  - `weekly` = จ่ายรายสัปดาห์
  - `monthly` = จ่ายรายเดือน
- ปรับให้ `rate` ถูกใช้เป็น `ค่าจ้างต่อวัน` เสมอ
- ผลคือ:
  - ถ้าพนักงานตั้ง `rate = 345`
  - และรอบนี้ทำงาน 3 วัน
  - `ค่าแรงงวดนี้ = 345 x 3 = 1,035`
- หน้าแอดมินและหน้าพนักงานถูกแก้ข้อความใหม่ให้แสดง "ค่าจ้างต่อวัน" แทนการสื่อว่าเป็นบาท/สัปดาห์หรือบาท/เดือน
- ฟอร์มแก้ไขพนักงานถูกแก้ label จาก `ประเภทค่าจ้าง` เป็น `รอบจ่ายเงิน`

## Update 2026-06-18 (urgent leave deduction)

- แก้หน้า `EmpHistory.jsx` ให้ "ลาด่วนเช้าวันงานโดยไม่มีเหตุผล" ดูจากเงื่อนไข:
  - วันที่ลา = วันนี้
  - เหตุผลว่าง
- ไม่บังคับว่าต้องยื่นหลังเวลาเข้างานแล้วค่อยถือเป็นลาด่วน
- ตอนพนักงานกดยื่นลา ระบบจะยัง **ไม่** สร้างรายการหักเงินทันที
- ย้าย logic การหักเงินไปอยู่ตอนแอดมินกดอนุมัติใน `AdminDashboard.jsx`
- ถ้าแอดมินปฏิเสธ ระบบจะลบรายการหักอัตโนมัติของลาด่วนวันนั้นออก
- เพิ่ม SQL migration:
  - `supabase/23_urgent_leave_deduct_on_approval.sql`
  - ใช้ override `public.employee_request_leave(...)` เพื่อไม่ให้ฝั่ง database สร้าง adjustment ตอน submit leave

## โฟลเดอร์ที่ใช้ทำงานตอนนี้

- Working copy:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy`

## งานที่ทำเสร็จรอบนี้

### Payroll / คำนวณเงิน

- แก้ bug การคิดค่าแรงพนักงาน "รายสัปดาห์" ที่เดิมเอาเรทรายสัปดาห์ไปหารด้วยจำนวนวันในรอบที่เปิดดู (เช่น 26 วัน) ทำให้ค่าแรงต่อวันต่ำผิดจริง
- ปรับ payroll engine ให้:
  - รายวัน = คิดตามวันทำงานจริง
  - รายสัปดาห์ = เฉลี่ยตามจำนวนวันทำงานต่อสัปดาห์ของพนักงานจริง
  - รายเดือน = เฉลี่ยตามจำนวนวันทำงานในรอบเดือนของพนักงานจริง
- เพิ่ม `scheduledDaysPerWeek()` และ `scheduledDaysLabel` ใน `payroll.js`
- ปรับข้อความในหน้าแอดมินและหน้าพนักงานให้บอกชัดว่าโปรแกรมกำลังเฉลี่ยจาก "กี่วันต่อสัปดาห์/กี่วันต่อรอบ"
- ปรับหน้า `AdminPayroll.jsx` ให้ดูง่ายขึ้น
- เพิ่ม filter ตามประเภทค่าจ้าง:
  - ทุกประเภทค่าจ้าง
  - รายวัน
  - รายสัปดาห์
  - รายเดือน
- เปลี่ยนจากตารางกว้าง เป็น card รายพนักงาน
- แยกความหมายชัดเจน:
  - `ค่าจ้างที่ตั้งไว้`
  - `ค่าแรงงวดนี้`
  - `รอบจ่ายของคนนี้`
- แสดงรอบคำนวณจริงของแต่ละพนักงานตาม:
  - `weekly_cycle_start_day`
  - `monthly_cycle_start_day`

### Employee detail / ข้อมูลพนักงาน

- หน้า `AdminEmployees.jsx` รองรับและแสดง:
  - ประเภทค่าจ้าง
  - วันเริ่มรอบสัปดาห์
  - วันที่เริ่มรอบเดือน
- เปลี่ยนคำจาก `ค่าแรงฐาน` เป็น `ค่าแรงงวดนี้` ในจุดที่เกี่ยวข้อง

### Employee app / หน้ารายได้พนักงาน

- เขียน `EmpPay.jsx` ใหม่เพื่อแก้ข้อความไทยเพี้ยนจาก encoding เดิม
- ทำข้อความให้ตรงกับฝั่งแอดมิน:
  - `อัตราค่าจ้างที่ตั้งไว้`
  - `ค่าแรงงวดนี้`
  - `รอบคำนวณ`
  - `เงินสุทธิ`
- ยังคง logic เดิมของ payroll engine ไว้

## ไฟล์ที่แก้ล่าสุด

- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`
- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`
- `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\employee\EmpPay.jsx`

## Build status

- รัน build ผ่านแล้ว
- คำสั่ง:
  `npm.cmd run build`
- ตำแหน่งที่รัน:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app`

## ประเด็นที่ต้องระวัง

- แอปพนักงานใช้งานลงเวลาอยู่จริง
- ห้ามทำให้พนักงานหลุดไปหน้าฝั่งแอดมินหรือเจ้าของร้าน
- งานรอบนี้ยังไม่ได้ deploy
- เป็นการแก้ใน working copy เท่านั้น ยังไม่ sync กลับ repo หลัก HR

## งานค้างแนะนำต่อ

1. เก็บ UX หน้า `AdminPayroll.jsx` เพิ่มอีกนิด
   - ทำให้ส่วนรอบจ่ายเด่นขึ้น
   - ทำให้การแยกค่าจ้างตั้งต้น vs ค่าแรงงวดนี้ ชัดขึ้นอีก
2. ทดสอบหน้า `EmpPay.jsx` ใน browser จริงหลัง deploy
3. ถ้าจะเอาขึ้นระบบจริง ให้ย้าย patch จาก working copy กลับเข้า repo HR หลักก่อน build/deploy

## สถานะพร้อมส่งต่อ

- พร้อมให้ทีมต่อยอดเรื่อง payroll ได้ทันที
- พร้อมให้ทีม deploy ต่อเมื่อยืนยันว่าจะใช้ชุดแก้จาก working copy นี้

## Update 2026-06-19 (cycle explanation and payroll clarity)

- Added cycle math helpers in:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\lib\payroll.js`
  - `countDaysInRange(range)`
  - `offDaysInRange(range, dayOff)`
- `computePay()` now also returns:
  - `cycleDaysTotal`
  - `cycleDaysElapsed`
  - `offDaysTotal`
  - `offDaysElapsed`
  - `scheduledDaysElapsed`
- This does **not** change the base pay formula itself.
- It makes the UI explain the cycle more clearly:
  - total calendar days in this cycle
  - regular off days in this cycle
  - scheduled work days in this cycle
  - how many days in the cycle have passed up to today
  - how many scheduled work days have passed up to today

### UI updates

- Employee pay page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\employee\EmpPay.jsx`
  - now shows full cycle day count vs off days vs scheduled work days
  - now shows elapsed cycle days up to today

- Admin payroll page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`
  - cards now explain cycle totals, off days, scheduled work days, and elapsed days

- Employee detail / admin employee page:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`
  - summary card now shows cycle totals and elapsed cycle values for weekly/monthly staff

### Build

- Build passed:
  `npm.cmd run build`

## Update 2026-06-19 (agent workflow and auto deploy prep)

Added a dedicated agent rulebook:

- `AGENT_WORKFLOW.md`

Purpose:

- Defines the HR JEBAR project paths.
- Defines the safe work loop for the coding agent.
- Defines payroll rules so `rate` is always treated as daily wage.
- Defines deploy and version rules.
- Records that employee pages must never route employees to admin/owner pages.

Added GitHub Actions workflow:

- `.github/workflows/deploy-cloudflare-pages.yml`

Purpose:

- On push to `main`, GitHub Actions can build `app` and deploy `app/dist` to Cloudflare Pages project `hr-jebar`.
- Also supports manual run from GitHub Actions via `workflow_dispatch`.

Required GitHub repo secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Updated Cloudflare config:

- `wrangler.jsonc`

Changes:

- Added `pages_build_output_dir = "app/dist"`.
- Changed static asset directory to `app/dist`.

Build check:

- `npm.cmd run build` passed after these changes.

## Update 2026-06-19 (visible build version)

- Updated file:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\lib\version.js`

### Version

- Current visible app badge:
  `Build 2026.06.19-hr-payroll-daily1`

### Build

- Build passed after version update:
  `npm.cmd run build`

## Test 2026-06-19 (payroll daily build verification)

- `src/lib/payroll.js` lint check passed:
  `npx.cmd eslint src/lib/payroll.js`
- Production build passed:
  `npm.cmd run build`
- Build output JS changed after latest payroll/version fix:
  `dist/assets/index-lODRoa23.js`
- Full project lint still reports older React hook / unused / irregular whitespace issues across several existing pages. These do not block Vite build, but should be cleaned separately if the team wants a fully green lint run.
- Build location:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app`

## Update 2026-06-19 (admin payroll now follows each employee cycle)

- Root issue found:
  `AdminPayroll.jsx` was still using the page-level selected period for everyone.
  That caused weekly employees to sometimes be calculated on a monthly window in the admin payroll screen.

- Fixed in:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminPayroll.jsx`

### What changed

- Added local helper:
  - `payrollPeriodForEmployee(emp, requestedPeriod)`
- Weekly employees now always use `week`
- Monthly employees now always use `month`
- Daily employees still follow the requested page period as before

### Also fixed

- Payroll rows now store `effectivePeriod`
- Manual net adjustment note prefix now uses the employee's real cycle instead of the page-level period
- Advance / deduction modal now opens with the employee's actual cycle
- Payroll summary text sent to employees now uses the employee's real cycle label

### Expected result

- Weekly employee cards in admin payroll should stop showing monthly-style ranges
- The admin payroll page should now match the employee detail page logic
- This should remove the confusing "9 days in a weekly cycle" behavior caused by wrong range selection

### Build

- Build passed after this fix:
  `npm.cmd run build`

## Update 2026-06-19 (daily payroll timeline on admin employee page)

- Updated file:
  `C:\Users\TEST_Lenovo\Documents\Codex\2026-06-06\jebar-data-https-gorgeous-hamster-dfb363\work\HR-JEBAR-copy\app\src\pages\admin\AdminEmployees.jsx`

### What changed

- Added daily timeline helpers:
  - `groupAdjustmentsByDate(adjustments)`
  - `summarizeTimeline(items)`
  - `toSyntheticAttendance(items)`
- Employee detail page now builds payroll summary from the full daily timeline, not only raw attendance rows.
- Added a new admin section:
  - `ตารางสรุปรายวัน`
  - shows worked days
  - leave days
  - off days
  - payable days
- Added explicit `รายการวันหยุดในรอบนี้`
  - off-day dates are now visible as date badges
- Daily history rows now show:
  - date
  - current status
  - clock in/out
  - any bonus / advance / deduction on that date
- Added per-day edit button:
  - `แก้วัน`
  - opens `AttendanceDayModal`
  - admin can set day status to:
    - present
    - late
    - leave
    - absent
  - admin can set paid leave
  - admin can edit clock-in / clock-out / OT minutes
  - admin can also reset one day back to automatic state by deleting that attendance override

### Adjustment quality-of-life

- `AddAdjModal` now includes a date field
- bonuses / advances / deductions can be attached to the actual date they happened
- those items now appear directly under the matching day in the timeline

### Important limitation still remaining

- There is still no dedicated persistent `paid already` daily flag/table in Supabase.
- Right now daily rows can clearly show:
  - work / late / leave / absent
  - off day
  - bonus
  - advance
  - deduction
- If the team wants an explicit `วันนี้จ่ายเงินแล้ว` marker per date, that should be added as a new table or field in a later migration.

### Build

- Build passed:
  `npm.cmd run build`
