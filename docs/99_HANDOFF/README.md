# 99_HANDOFF

## Purpose
รวมทางเข้าไปยัง handoff เดิมและประวัติการเปลี่ยนแปลง เพื่อไม่ให้ข้อมูลสำคัญหายระหว่าง Documentation Refactor

## Source documents
- `../../HANDOFF.md` — release/update handoff history
- `../../AGENT_WORKFLOW.md` — agent workflow and operational rules
- `../../design_handoff_hr_jebar/README.md` — original HR design handoff
- `../../design_handoff_hr_jebar/design_handoff_hr_jebar/README.md` — duplicate candidate

## Merge plan
1. ตรวจ diff ของ design handoff ทั้งสองไฟล์
2. ย้ายเนื้อหา authoritative เข้า module docs โดยรักษา source links
3. คงไฟล์เดิมไว้จนกว่าจะตรวจสอบว่าข้อมูลไม่หาย
