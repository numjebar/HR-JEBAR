# DOCUMENT_STANDARD

## Naming
- ใช้ `README.md` เป็นหน้าแรกของแต่ละ module
- ใช้ชื่อไฟล์ภาษาอังกฤษแบบ `UPPER_SNAKE_CASE.md` สำหรับเอกสารมาตรฐาน เช่น `REQUIREMENTS.md`, `WORKFLOW.md`, `DATABASE.md`
- เอกสารเฉพาะระบบภายนอกใช้ชื่อชัดเจน เช่น `INTEGRATION_OPERATE.md`

## Required files per module
1. `README.md` — scope, owner, current status, source links
2. `REQUIREMENTS.md` — functional/non-functional requirements
3. `WORKFLOW.md` — user/system flow
4. `DATABASE.md` — tables, fields, RLS, migrations
5. `API.md` — RPC/endpoints/events/integrations
6. `SECURITY.md` — permissions, roles, sensitive data
7. `TODO.md` — missing info, open questions, next documentation tasks

## Status labels
- `พร้อมใช้` — มีข้อมูลพอใช้เป็น reference
- `บางส่วน` — มีข้อมูลแต่ยังไม่ครบ
- `ต้องตรวจสอบเพิ่มเติม` — ยังไม่มีข้อมูลต้นทางหรือข้อมูลไม่พอ
- `ซ้ำ/รอรวม` — มีหลายไฟล์ที่ควรรวมหลังตรวจ diff

## Documentation rules
- ระบุ source file ทุกครั้งเมื่อสรุปข้อมูลจากเอกสารเดิม
- หากเป็น business rule ให้คง wording/ตัวเลขสำคัญ เช่น payroll formulas, RLS rule, geofence rule
- ห้ามเขียน requirement ใหม่จากการคาดเดา
- ถ้าข้อมูลไม่พอ ให้เขียน `ต้องตรวจสอบเพิ่มเติม` พร้อมรายการคำถาม
