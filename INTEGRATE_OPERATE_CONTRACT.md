# การเชื่อมต่อ HR → JE BAR Operate

สำหรับ: ทีม HR JEBAR  
อ้างอิง: `INTEGRATE_HR_CONTRACT.md` ฝั่ง Operate  

---

## วิธีเปิด Operate จากแอป HR

```jsx
// components/OpenOperateButton.jsx
export function OpenOperateButton({ employee, branch }) {
  function openOperate() {
    const url = new URL('https://je-bar-operate.pages.dev/');
    url.searchParams.set('mode', 'employee');
    url.searchParams.set('emp_id', employee.id);          // เช่น EMP001
    url.searchParams.set('emp_name', employee.name);       // เช่น สมชาย
    url.searchParams.set('branch', branch);                // เช่น JE BAR
    url.searchParams.set('from_hr', '1');
    window.open(url.toString(), '_blank');
  }

  return (
    <button onClick={openOperate}>
      เปิดระบบสต็อก
    </button>
  );
}
```

## URL ที่ใช้

```
https://je-bar-operate.pages.dev/?mode=employee&emp_id=EMP001&emp_name=สมชาย&branch=JE+BAR&from_hr=1
```

## สิ่งที่พนักงานทำได้ใน Operate

| หน้าที่ | การใช้งาน |
|------|----------|
| ถ่ายบิลซื้อของ | สแกนเอกสาร / ถ่ายรูป |
| รับวัตถุดิบเข้า | บันทึกยอดเพิ่มสต็อก |
| ตัดออก/ปรับยอดสต็อก | บันทึกความเคลื่อนไหว |
| บันทึกผลิต | ตัดวัตถุดิบตามสูตร |
| ดูยอดสต็อก | จอฟรีด Read-only |

## ข้อมูลที่ Operate เขียนไป Supabase

ทีม HR Admin หรือ Admin UI เห็นได้จาก Supabase:

- `db.integrationInbox[]` — บิลที่ถ่ายมา (มี `createdBy`, `branch`, `imageUrl`)
- `db.stockMovements[]` — ทุกการรับเข้า/ตัดออก (มี `createdBy`)
- `db.productionEvents[]` — บันทึกผลิต (มี `createdBy`, `menuName`)
- `db.purchaseEvents[]` — รับซื้อวัตถุดิบ (มี `totalCost`)

ทุก record มี: `createdBy`, `createdByName`, `branch`, `source: 'hr-employee'`

## ความปลอดภัย

- พนักงานไม่เห็นหน้า AI / ข้อมูลหลัก / ตั้งค่า
- ไม่มีปุ่มสลับโหมดเจ้าของร้าน
- session หมดเมื่อปิด tab

> ดูรายละเอียดเต็มที่: `INTEGRATE_HR_CONTRACT.md` ใน repo je-bar-operate branch `claude/continuation-7d4rf1`
