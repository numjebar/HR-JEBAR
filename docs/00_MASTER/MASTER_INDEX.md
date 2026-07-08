# MASTER_INDEX — LUCID / HR JEBAR Documentation

## 1. Master Documents
| เอกสาร | วัตถุประสงค์ | สถานะ |
|---|---|---|
| [`../START_HERE.md`](../START_HERE.md) | จุดเริ่มต้นสำหรับทุกคน | พร้อมใช้ |
| [`DOCUMENT_STANDARD.md`](DOCUMENT_STANDARD.md) | มาตรฐานเอกสาร | พร้อมใช้ |
| [`ROADMAP.md`](ROADMAP.md) | แผนปรับปรุงเอกสาร | พร้อมใช้ |
| [`GLOSSARY.md`](GLOSSARY.md) | คำศัพท์กลาง | โครงสร้างเริ่มต้น |
| [`CHANGELOG.md`](CHANGELOG.md) | บันทึกการเปลี่ยนแปลงเอกสาร | โครงสร้างเริ่มต้น |
| [`CODING_STANDARD.md`](CODING_STANDARD.md) | มาตรฐานโค้ดที่อ้างอิงจากเอกสารเดิม | โครงสร้างเริ่มต้น |

## 2. Module Index และ Priority
| ลำดับ | Module | Folder | Priority | สถานะข้อมูล | หมายเหตุ |
|---:|---|---|---|---|---|
| 1 | HR | [`../09_HR/`](../09_HR/) | P0 | มีข้อมูลมาก | แกนหลักของ repo นี้: attendance, payroll, employee/admin app |
| 2 | Security | [`../14_SECURITY/`](../14_SECURITY/) | P0 | บางส่วน | มี RLS, auth, employee data isolation จาก design handoff |
| 3 | Database | [`../02_DATABASE/`](../02_DATABASE/) | P0 | บางส่วน | มี [`DATA_MODEL.md`](../02_DATABASE/DATA_MODEL.md) จาก handoff และ SQL/RPC notes |
| 4 | Deployment | [`../18_DEPLOYMENT/`](../18_DEPLOYMENT/) | P1 | บางส่วน | มี Cloudflare Pages และ build/deploy notes |
| 5 | Operations | [`../20_OPERATIONS/`](../20_OPERATIONS/) | P1 | บางส่วน | มี agent workflow, open concern, external project notes |
| 6 | Architecture | [`../01_ARCHITECTURE/`](../01_ARCHITECTURE/) | P1 | บางส่วน | มี recommended architecture จาก design handoff |
| 7 | Mobile | [`../17_MOBILE/`](../17_MOBILE/) | P1 | บางส่วน | มี employee mobile app flow |
| 8 | Dashboard | [`../11_DASHBOARD/`](../11_DASHBOARD/) | P2 | บางส่วน | มี admin dashboard summary จาก design handoff |
| 9 | Inventory | [`../05_INVENTORY/`](../05_INVENTORY/) | P2 | บางส่วน | มี [`INTEGRATION_OPERATE.md`](../05_INVENTORY/INTEGRATION_OPERATE.md) สำหรับ HR → Operate |
| 10 | Payment | [`../15_PAYMENT/`](../15_PAYMENT/) | P2 | บางส่วน | มี payroll payment marker แต่ยังไม่ใช่ payment gateway |
| 11 | POS | [`../04_POS/`](../04_POS/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 12 | Recipe | [`../06_RECIPE/`](../06_RECIPE/) | P3 | ต้องตรวจสอบเพิ่มเติม | พบเฉพาะ catalog cake context แยกโปรเจกต์ |
| 13 | Ingredients | [`../07_INGREDIENTS/`](../07_INGREDIENTS/) | P3 | ต้องตรวจสอบเพิ่มเติม | พบใน Operate integration เท่านั้น |
| 14 | CRM | [`../08_CRM/`](../08_CRM/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 15 | Marketing | [`../10_MARKETING/`](../10_MARKETING/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 16 | AI | [`../12_AI/`](../12_AI/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 17 | Guardian | [`../13_GUARDIAN/`](../13_GUARDIAN/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 18 | Customer App | [`../16_CUSTOMER_APP/`](../16_CUSTOMER_APP/) | P3 | ต้องตรวจสอบเพิ่มเติม | ไม่มีเอกสารเฉพาะใน repo นี้ |
| 19 | Branding | [`../19_BRANDING/`](../19_BRANDING/) | P3 | บางส่วน | มี design tokens/logo note จาก handoff |
| 20 | Core Engine | [`../03_CORE_ENGINE/`](../03_CORE_ENGINE/) | P0 | บางส่วน | มี [`PAYROLL_RULES.md`](../03_CORE_ENGINE/PAYROLL_RULES.md) สำหรับ payroll/rules engine |

## 3. Existing Source Documents Inventory
| Source file | Classification | Action |
|---|---|---|
| `AGENT_WORKFLOW.md` | Operations / Deployment / Payroll rule | คงไว้ และอ้างอิงจาก Operations |
| `HANDOFF.md` | Handoff / Change history | คงไว้ และจัด index ใน `99_HANDOFF` |
| `INTEGRATE_OPERATE_CONTRACT.md` | Integration / Inventory / Operations | คงไว้ และอ้างอิงใน Inventory/Operations |
| `CATALOG_CAKE_FIX_NOTES.md` | External project bugfix notes | แยกเป็น Operations archive; ต้องตรวจสอบว่าเป็น LUCID scope หรือไม่ |
| `design_handoff_hr_jebar/README.md` | HR design handoff | เอกสารต้นทางซ้ำกับ nested README; ใช้เป็น reference หลัก |
| `design_handoff_hr_jebar/design_handoff_hr_jebar/README.md` | Duplicate design handoff | ควรรวมกับไฟล์ด้านบนหลังตรวจสอบ diff |
| `app/README.md` | Vite template README | ควรแทนที่ด้วย app-specific README ใน phase ถัดไป |

## 4. Duplicate / Merge Candidates
| กลุ่ม | ไฟล์ | ข้อเสนอ |
|---|---|---|
| HR Design Handoff | `design_handoff_hr_jebar/README.md`, `design_handoff_hr_jebar/design_handoff_hr_jebar/README.md` | ตรวจสอบ diff แล้วรวมเป็น `09_HR/DESIGN_HANDOFF.md` หรือคงต้นฉบับหนึ่งไฟล์ |
| Payroll updates | หลาย section ใน `HANDOFF.md` และ `AGENT_WORKFLOW.md` | เริ่มแยกเป็น `03_CORE_ENGINE/PAYROLL_RULES.md`; phase ถัดไปควร map กับ source code |
| Deployment notes | `AGENT_WORKFLOW.md`, `HANDOFF.md` | รวมเป็น `18_DEPLOYMENT/README.md` ใน phase ถัดไป |
| Operate/Inventory | `INTEGRATE_OPERATE_CONTRACT.md`, sections ใน `HANDOFF.md` | เริ่มรวมเป็น `05_INVENTORY/INTEGRATION_OPERATE.md`; ยังต้องตรวจ contract ฝั่ง Operate |

## 5. Missing Information
- Product scope ของ LUCID ที่ชัดเจนว่า HR JEBAR เป็น module เดี่ยวหรือเป็นส่วนหนึ่งของ platform ใหญ่
- Database schema ปัจจุบันแบบ authoritative และ migration order ทั้งหมด
- API/RPC reference ที่ครบถ้วน
- Environment variables และ secret management policy ที่เป็นปัจจุบัน
- Testing policy และ release checklist ล่าสุด
- Owner ของแต่ละ module และระดับความพร้อมใช้งาน production
