# DATA_MODEL — HR JEBAR

## Status
บางส่วน — รวบรวมจาก design handoff และ handoff updates; ยังไม่ใช่ schema authoritative จาก database จริง

## Source documents
- `design_handoff_hr_jebar/README.md`
- `HANDOFF.md`
- `AGENT_WORKFLOW.md`

## Entities from handoff
| Entity | Purpose | Key notes |
|---|---|---|
| `branch` | ข้อมูลสาขาและ geofence | มี `lat`, `lng`, `radius`, per-branch rules, shop rules |
| `employee` | ข้อมูลพนักงาน | ข้อมูลทั่วไปบางส่วน employee-editable; financial/time fields admin-only |
| `attendance` | ลงเวลารายวัน | หนึ่ง row ต่อ employee ต่อวัน; ใช้กับ payroll และ monthly summary |
| `sale` | แหล่ง commission | ใช้คำนวณ commission ตามยอดขายหรือจำนวน unit |
| `adjustment` | รายการเงินเพิ่ม/หัก | bonus, damage, advance, other; note เป็นเหตุผล |
| `leave` | คำขอลา | pending/approved/rejected; urgent leave เกี่ยวกับ auto deduction |
| `message` | chat/task | admin↔employee, read receipts, task done status |
| `prefs` | notification settings | ต่อ employee |
| `payroll_payments` | marker การจ่ายเงิน payroll | มาจาก handoff v57/v58; ใช้ mark/unmark paid ต่อรอบจ่าย |

## Known SQL / RPC references from handoff
| Item | Purpose | Source status |
|---|---|---|
| `supabase/30_payroll_payments.sql` | สร้าง `payroll_payments`, RLS admin-only, RPC mark/unmark paid, และ update employee pay data | กล่าวถึงใน `HANDOFF.md`; ต้องตรวจว่ามีไฟล์จริงและ version ล่าสุด |
| `employee_pay_data` | Security definer RPC สำหรับคืนข้อมูลรายได้ของ employee | กล่าวถึงใน v58 update |
| `employee_pay_data_v2` | Session-token based employee pay access | กล่าวถึงใน v58 update |
| `attendance` upsert `onConflict: emp_id,date` | Admin edit attendance per day | กล่าวถึงใน v59 update |

## RLS / permission implications
- Employee อ่าน/แก้เฉพาะข้อมูลตัวเองตาม matrix ใน handoff.
- Admin อ่าน/เขียนทุกข้อมูลภายใน org/scope ที่รับผิดชอบ.
- Payroll payment records มี RLS เฉพาะ admin; employee เห็นผ่าน RPC เท่านั้น.

## Missing / ต้องตรวจสอบเพิ่มเติม
- Schema จริงจาก Supabase production.
- Migration order ทั้งหมดใน `supabase/`.
- Indexes/constraints/foreign keys/current RLS policies.
- ตารางที่เพิ่มหลัง handoff v60.
