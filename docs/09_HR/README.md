# 09_HR — HR JEBAR

## Status
บางส่วน / ข้อมูลมากที่สุดใน repo นี้

## Scope from existing documents
- Employee app: clock in/out, leave request, pay view, messages, profile.
- Admin console: employees, attendance, payroll, messages/tasks, branch/rule settings.
- Payroll cycle and attendance summaries.

## Source documents
- `design_handoff_hr_jebar/README.md`
- `design_handoff_hr_jebar/design_handoff_hr_jebar/README.md` (duplicate candidate)
- `HANDOFF.md`
- `AGENT_WORKFLOW.md`

## Priority
P0 — เป็นแกนหลักของ repo นี้ และมี business rules สำคัญ เช่น attendance, payroll, employee data visibility.

## Must preserve
- Employee app must not link employees to admin/owner pages.
- Attendance check-in/check-out must keep working before deploy.
- Payroll changes must be tested with real employee examples before deploy.
- Payroll formula and pay cycle rules must not be rewritten from memory.

## Missing / ต้องตรวจสอบเพิ่มเติม
- Current complete database schema and migration order.
- Current production auth/session model.
- Current API/RPC list.
