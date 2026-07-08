# PAYROLL_RULES — Core Engine

## Status
บางส่วน — คัดแยก business rules จากเอกสารเดิมเพื่อป้องกันการสรุปผิด; ห้ามแก้สูตรจากไฟล์นี้โดยไม่ตรวจ source code/current DB

## Source documents
- `AGENT_WORKFLOW.md`
- `design_handoff_hr_jebar/README.md`
- `HANDOFF.md`

## Current payroll rule from operational workflow
- `employees.rate` หมายถึงค่าแรงรายวันเป็นบาท/วัน.
- `employees.pay_type` หมายถึงรอบการจ่ายเงินเท่านั้น:
  - `daily`: รอบจ่ายรายวัน
  - `weekly`: รอบจ่ายรายสัปดาห์
  - `monthly`: รอบจ่ายรายเดือน
- Weekly cycle เริ่มจาก `employees.weekly_cycle_start_day`.
- Monthly cycle เริ่มจาก `employees.monthly_cycle_start_day`.
- วันหยุดประจำมาจาก `employees.day_off`.
- Base pay สำหรับรอบปัจจุบันคือ `daily wage x payable days in selected/current cycle`.

## Payroll engine formula from design handoff
ให้ employee, attendance/sales/adjustments ใน period และ effective rules (`global ⊕ branch ⊕ person`):

| Component | Rule |
|---|---|
| `hourlyRate` | daily: `rate / 8`; monthly: `rate / (26 × 8)` |
| `dayRate` | daily: `rate`; monthly: `rate / 26` |
| `base` | sum ของ dayRate สำหรับ present/late/paid-leave days |
| Late deduction: `permin` | total late minutes × `lateDeductPerMin` |
| Late deduction: `tiered` | late > `lateBigMin` = 1 unit; late between minor/big สะสมครบ `lateMinorCount` = 1 unit; deduction = units × `lateDeductHours` × hourlyRate |
| OT pay | `(otMin / 60) × fixed otRatePerHour` หรือ `(otMin / 60) × hourlyRate × otMultiplier` |
| Commission | percent: sum amount × pct/100; unit: sum units × perUnit |
| Adjustments | bonus เพิ่ม; damage/advance/other หัก |
| Gross | base + otPay + commission + bonus |
| Social security | fixed: `ssAmount`; percent: min(gross × ssPercent/100, ssMax) |
| Net | gross − lateDeduct − damage − advance − other − social security |

## Rule hierarchy
1. Global defaults
2. Branch rules override global
3. Employee/person ruleOverrides override branch/global

## Must preserve
- Payroll changes require testing with real employee examples before deploy.
- Paid marker state must persist per employee/cycle.
- Employee-facing paid status is read through controlled RPC flow, not direct payroll payment table access.

## Missing / ต้องตรวจสอบเพิ่มเติม
- Current implementation file(s) for the payroll engine.
- Current test cases or real employee examples used for payroll validation.
- Edge cases for day off, absent, paid leave, unpaid leave, and manual attendance edits.
