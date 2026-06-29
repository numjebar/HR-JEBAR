# Documentation Roadmap

## Phase 1 — Inventory (เสร็จใน v1)
- สร้างรายการเอกสาร Markdown ทั้งหมดใน repo
- จัดกลุ่มเอกสารตาม module
- ระบุ duplicate และ missing info

## Phase 2 — Classification
- ตรวจ diff ของ design handoff README ที่ซ้ำกัน
- แยกข้อมูล HR, Security, Database, Deployment ออกจาก handoff เดิมเป็นเอกสาร module
- ทำ source map ว่าแต่ละเอกสารมาจากไฟล์ใด

## Phase 3 — Standardization
- เติม required files ให้ module P0: HR, Core Engine, Database, Security
- สร้าง template กลางจาก `_templates/MODULE_README_TEMPLATE.md`
- แทนที่ `app/README.md` ที่ยังเป็น Vite template ด้วย app-specific README

## Phase 4 — Final Knowledge Base
- รวม duplicate documents หลังตรวจสอบครบ
- ทำ cross-link ระหว่าง module
- สร้าง release/deployment checklist ที่อ้างอิงจาก workflow เดิม
