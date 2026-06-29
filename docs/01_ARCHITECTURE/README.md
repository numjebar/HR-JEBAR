# 01_ARCHITECTURE — System Architecture

## Status
บางส่วน — สรุปจากเอกสาร handoff เดิมเท่านั้น ยังไม่ยืนยันกับ production implementation ล่าสุด

## Source documents
- `design_handoff_hr_jebar/README.md`
- `design_handoff_hr_jebar/design_handoff_hr_jebar/README.md` (duplicate candidate; diff แล้วพบว่าไม่เหมือนกัน)
- `AGENT_WORKFLOW.md`
- `HANDOFF.md`

## Current architecture summary
HR JEBAR เป็นระบบลงเวลาและคำนวณเงินพนักงานสำหรับร้าน/ธุรกิจหลายสาขา โดยแบ่งผู้ใช้หลักเป็น 2 ฝั่ง:

1. **Employee app** — ใช้งานบนมือถือสำหรับพนักงาน เช่น check-in/check-out, ขอลา, ดูรายได้, ข้อความ, profile.
2. **Admin console** — ใช้งานโดยแอดมิน/เจ้าของร้าน เช่น จัดการพนักงาน, สาขา, attendance, payroll, messages/tasks, rules.

## Recommended synced architecture from handoff
เอกสาร handoff เดิมเสนอแนวทางสำหรับ production/cross-device version ดังนี้:

| Layer | Recommendation | Status |
|---|---|---|
| Backend/DB/Auth/Realtime | Supabase: Postgres, Row-Level Security, Realtime, Storage | ต้องตรวจสอบว่าเป็น current production source of truth หรือไม่ |
| Frontend | React; prototype เดิมเป็น React | ใช้งานจริงใน repo นี้เป็น React/Vite |
| File storage | Supabase Storage/Firebase Storage for profile photo, bank QR, ID card, check-in selfies | ต้องตรวจสอบเพิ่มเติม |
| Realtime | Subscribe to messages, attendance, leaves | ต้องตรวจสอบเพิ่มเติม |

## Critical boundaries
- Employee app ต้องไม่ link ไป admin/owner pages.
- Employee ต้องเห็นเฉพาะข้อมูลของตัวเอง.
- Payroll/rules/geofence logic เป็น business-critical และต้องอ้างอิง source เดิมก่อนแก้ไข.

## Missing / ต้องตรวจสอบเพิ่มเติม
- แผนผัง architecture ปัจจุบันของ production deployment.
- รายการ environment variables ที่ใช้จริง.
- รายละเอียด Supabase project, tables, storage buckets, realtime subscriptions ที่เป็น current state.
