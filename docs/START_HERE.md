# START_HERE — LUCID / HR JEBAR Documentation Knowledge Base

> สถานะ: Documentation Refactor v1
> ขอบเขตงาน: จัดระเบียบเอกสารเท่านั้น — ไม่เพิ่มฟีเจอร์ ไม่แก้ Business Logic และไม่แก้โค้ด

## จุดประสงค์
เอกสารชุดนี้เป็นจุดเริ่มต้นสำหรับ AI, นักพัฒนา และทีมธุรกิจที่ต้องทำงานต่อกับ LUCID / HR JEBAR โดยมีเป้าหมายให้เอกสารเป็น Source of Truth ที่ค้นหา อ้างอิง และส่งต่อได้ง่าย

## อ่านตามลำดับนี้
1. [`00_MASTER/MASTER_INDEX.md`](00_MASTER/MASTER_INDEX.md) — สารบัญหลักและสถานะเอกสารทั้งหมด
2. [`00_MASTER/DOCUMENT_STANDARD.md`](00_MASTER/DOCUMENT_STANDARD.md) — มาตรฐานเอกสารและรูปแบบไฟล์
3. [`00_MASTER/ROADMAP.md`](00_MASTER/ROADMAP.md) — แผนปรับปรุงเอกสารเป็นลำดับขั้น
4. [`09_HR/README.md`](09_HR/README.md) — โมดูล HR JEBAR ซึ่งเป็นข้อมูลที่สมบูรณ์ที่สุดใน repo นี้
5. [`99_HANDOFF/README.md`](99_HANDOFF/README.md) — Handoff และบันทึกการเปลี่ยนแปลงเดิม

## กฎสำคัญสำหรับผู้ทำงานต่อ
- ห้ามเดาข้อมูลที่ไม่มีในเอกสารเดิม ให้ระบุว่า **ต้องตรวจสอบเพิ่มเติม**
- ห้ามลบเอกสารต้นฉบับโดยไม่มีการย้าย/อ้างอิงครบถ้วน
- ห้ามรวมข้อมูลจนรายละเอียด Business Rule, Payroll Rule, Security Rule หรือ Deployment Note หาย
- เอกสารที่เป็น source เดิมยังคงอยู่ใน repo และถูกอ้างอิงจาก Master Index

## สถานะภาพรวม
- มีเอกสาร HR JEBAR / Payroll / Attendance / Design Handoff ค่อนข้างครบ
- มีเอกสาร integration HR → JE BAR Operate
- มีเอกสาร catalog cake bugfix ซึ่งเป็นคนละโปรเจกต์/บริบทและควรแยกเก็บใน Operations หรือ Archive
- โมดูล LUCID หลายส่วนยังไม่มีเอกสารใน repo นี้ และถูกทำเครื่องหมายว่า **ต้องตรวจสอบเพิ่มเติม**
