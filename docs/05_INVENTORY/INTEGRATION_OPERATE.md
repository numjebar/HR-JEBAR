# INTEGRATION_OPERATE — HR → JE BAR Operate

## Status
บางส่วน — สรุปจาก integration contract เดิมเท่านั้น

## Source document
- `INTEGRATE_OPERATE_CONTRACT.md`

## Purpose
เปิด JE BAR Operate จาก HR employee context เพื่อให้พนักงานทำงาน stock/operate โดยไม่เห็น owner/admin-only areas.

## Launch URL pattern
```text
https://je-bar-operate.pages.dev/?mode=employee&emp_id=EMP001&emp_name=สมชาย&branch=JE+BAR&from_hr=1
```

## Parameters
| Parameter | Meaning |
|---|---|
| `mode=employee` | เปิด Operate ใน employee mode |
| `emp_id` | employee id จาก HR |
| `emp_name` | ชื่อพนักงาน |
| `branch` | สาขา |
| `from_hr=1` | marker ว่ามาจาก HR |

## Employee capabilities in Operate
- ถ่ายบิลซื้อของ
- รับวัตถุดิบเข้า
- ตัดออก/ปรับยอดสต็อก
- บันทึกผลิต
- ดูยอดสต็อกแบบ read-only/free screen

## Data written by Operate
| Data | Notes |
|---|---|
| `db.integrationInbox[]` | บิลที่ถ่ายมา; มี `createdBy`, `branch`, `imageUrl` |
| `db.stockMovements[]` | การรับเข้า/ตัดออก; มี `createdBy` |
| `db.productionEvents[]` | บันทึกผลิต; มี `createdBy`, `menuName` |
| `db.purchaseEvents[]` | รับซื้อวัตถุดิบ; มี `totalCost` |

ทุก record มี `createdBy`, `createdByName`, `branch`, `source: 'hr-employee'`.

## Security expectations
- พนักงานไม่เห็นหน้า AI / ข้อมูลหลัก / ตั้งค่า.
- ไม่มีปุ่มสลับโหมดเจ้าของร้าน.
- Session หมดเมื่อปิด tab.

## Missing / ต้องตรวจสอบเพิ่มเติม
- Contract ฝั่ง Operate: `INTEGRATE_HR_CONTRACT.md` ใน repo `je-bar-operate` branch `claude/continuation-7d4rf1`.
- วิธี auth/session ที่ใช้จริงระหว่าง HR และ Operate.
