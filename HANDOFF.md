# HR JEBAR Handoff

## Update 2026-06-20 (OPS photo + voice ครบทั้ง 6 ฟอร์ม — v3)

### สิ่งที่เพิ่มใน v3

| ฟอร์ม | SearchSelect | VoiceBtn | PhotoSection |
|---|---|---|---|
| ถ่ายบิล (bills) | — | ✅ vendor, note | ✅ (BillImageSection เดิม) |
| ผลิตขนม (production) | ✅ เมนู | ✅ quantity, batch, note | ✅ รูปการผลิต |
| วัตถุดิบ (inventory) | ✅ รายการ | ✅ stockLeft, note | ✅ รูปวัตถุดิบ |
| สต๊อกเค้ก (cake-stock) | ✅ ชื่อเค้ก | ✅ available, reserved, damaged, note | ✅ รูปสต๊อกเค้ก |
| ของใช้ (supplies-count) | ✅ รายการ | ✅ count, note | ✅ รูปสต๊อกของใช้ |
| ใบสั่งซื้อ (purchase-list) | ✅ รายการ | ✅ quantity, note | ✅ รูปประกอบ |

### ไฟล์ที่เปลี่ยน

- `app/src/components/PhotoSection.jsx` — NEW: reusable component (camera, album, lightbox, delete)
- `app/src/components/SearchSelect.jsx` — เพิ่มปุ่ม ▼/▲ toggle dropdown
- `app/src/pages/employee/EmpOps.jsx` — ครบทั้ง 6 ฟอร์ม
- `app/src/pages/admin/AdminOpsInbox.jsx` — แสดง photoCount/photoNames, เพิ่ม humanizeKey สำหรับ cake-stock fields
- `app/src/lib/version.js` — bump เป็น `Build 2026.06.20-hr-ops-v3`

### Payload sanitization (EmpOps → Supabase)

- blob URLs และ base64 ถูก strip ออกก่อนส่ง
- photos array ถูกแปลงเป็น `{ photoNames: [...], photoCount: N }`
- localStorage ไม่เก็บ photos array (blob URLs ใช้ได้แค่ session เดียว)

### Commit

- `bffe31d` feat: complete photo + voice + dropdown for all 6 OPS forms (v3)
- `28c135b` feat(AdminOpsInbox): show photo count + names for all OPS form types

### Deploy

ต้อง build+deploy จากเครื่อง Windows พร้อม `.env.local` หรือตั้ง GitHub Actions secrets:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

---

## Update 2026-06-19 (employee Operate handoff)

- HR employee home now opens the live Operate app directly:
  `https://je-bar-operate.pages.dev/`
- The employee button sends Operate these URL params:
  - `mode=employee`
  - `emp_id`
  - `emp_name`
  - `branch`
  - `from_hr=1`
- This follows the Operate contract from:
  `https://github.com/numjebar/je-bar-operate/blob/claude/continuation-7d4rf1/INTEGRATE_HR_CONTRACT.md`
- Employee flow no longer opens the old internal `/emp/ops` page from the main employee button.
- Admin/owner OPS link remains separate and opens the plain owner URL:
  `https://je-bar-operate.pages.dev/`
- Version badge updated to:
  `Build 2026.06.19-hr-operate-employee1`
- Build passed locally:
  `npm.cmd run build`
- Commit pushed to main:
  `843ecca Connect employee OPS button to Operate app`

### Deploy status

- GitHub Actions auto deploy for commit `843ecca` failed before build.
- Failure point:
  `Check required app env`
- Required GitHub Actions secrets before auto deploy can pass:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
- Production is still serving the previous bundle until the missing secrets are added and the workflow is rerun, or until a manual Cloudflare Pages deploy is performed from local `app/dist`.

### Branch note

- Remote branch `claude/continuation-7d4rf1` currently contains documentation-only changes:
  - `CATALOG_CAKE_FIX_NOTES.md`
  - `INTEGRATE_OPERATE_CONTRACT.md`
- It is diverged from `main`, so do not merge blindly into production.

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

## Update 2026-06-20 (Employee OPS system fully live)

### SQL migrations run in Supabase project `eoinzxqpqbybwcrmsgww`

- `25_employee_ops_entries.sql` — สร้างตาราง `employee_ops_entries` + RLS policies + RPCs:
  - `employee_submit_ops_entry(uuid, text, jsonb)`
  - `employee_get_ops_entries(uuid, text, int)`
  - `employee_submit_ops_entry_v2(session_token, task_key, payload)`
  - `employee_get_ops_entries_v2(session_token, task_key, limit)`
- `27_ops_entries_cake_stock.sql` — เพิ่ม `cake-stock` ใน allowed task keys
- `26_payroll_sync_rpc.sql` — สร้าง `get_payroll_month_summary(year, month)` สำหรับ JE-BAR-Operate ดึงข้อมูล payroll

### EmpOps.jsx — 6 แท็บครบและส่งข้อมูลเข้า Supabase ได้จริง

| Task key        | หน้าที่                             |
|-----------------|-------------------------------------|
| `bills`         | ถ่ายบิล + AI อ่านรายการ (Gemini)   |
| `production`    | บันทึกการผลิตขนม + SearchSelect     |
| `inventory`     | เช็กวัตถุดิบคงเหลือ + SearchSelect |
| `cake-stock`    | นับเค้กหน้าตู้ แยกสาขา             |
| `supplies-count`| นับของใช้สิ้นเปลือง               |
| `purchase-list` | ใบสั่งซื้อ multi-item + ความด่วน   |

### AdminOpsInbox.jsx — admin เห็นรายการทุกประเภทครบ

- ตาราง summary count 6 ประเภท
- filter ตาม task_key + วันที่
- `PurchaseListPreview` แสดงตารางพร้อมคอลัมน์ ความด่วน + ปุ่ม copy เป็น text
- `PayloadPreview` แสดง generic key-value สำหรับ bills / production / inventory / cake-stock / supplies-count

### Version

- `Build 2026.06.20-hr-ops-v2`

### Deploy status

- โค้ดถูก push ไปที่ `main` และ `claude/continuation-7d4rf1` แล้ว
- ยังต้องรัน build บนเครื่องที่มี `.env.local` (Supabase URL + anon key) แล้ว deploy ขึ้น Cloudflare Pages
- หรือเพิ่ม secrets ใน GitHub Actions ให้ครบ:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`

## Hotfix 2026-06-19 (production blank page recovery)

- Production `https://hr-jebar.pages.dev` was blank after GitHub auto deploy.
- Root cause: GitHub Actions built the Vite app without Supabase env values, so the generated JS bundle did not contain `VITE_SUPABASE_URL`.
- Immediate recovery:
  - Built locally from `app/.env.local`
  - Deployed `app/dist` directly to Cloudflare Pages project `hr-jebar`
  - Verified production JS contains the Supabase project URL again
- Cloudflare preview created by the recovery deploy:
  - `https://c061ebaf.hr-jebar.pages.dev`
- Production URL to use:
  - `https://hr-jebar.pages.dev`

### Auto deploy guardrail

- Updated `.github/workflows/deploy-cloudflare-pages.yml`
- Build step now receives:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- The workflow now checks these values before build.
- Required GitHub Actions secrets before using auto deploy again:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

If the two Vite Supabase secrets are missing, GitHub Actions should fail before deploy instead of publishing a blank app.
