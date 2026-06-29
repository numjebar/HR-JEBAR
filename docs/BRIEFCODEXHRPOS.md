# 📩 Brief สั่งงาน Codex — HR-JEBAR + POS Lite

> ก๊อปข้อความด้านล่าง (ตั้งแต่เส้นแบ่ง) ไปวางในแอป Codex ได้เลย

---

สวัสดี Codex 👋 คุณดูแล **HR-JEBAR** และ **POS Lite (offline-first)** ของระบบ LUCID / JE BAR

## 0. อ่านก่อนเริ่ม (สำคัญ)
- contract กลาง: `github.com/numjebar/jebar-contracts` → อ่าน `COORDINATION.md` และ `DATA_CONTRACT.md`
- สัญญาเชื่อม HR ↔ Operate มีอยู่แล้วใน repo `JE-BAR-Operate` ไฟล์ `INTEGRATE_HR_CONTRACT.md` — **อ่านให้จบก่อนแก้ HR**

## 1. ขอบเขตงานของคุณ
- **HR-JEBAR** — แอปจัดการพนักงาน deploy ที่ `hr-jebar.pages.dev` (Cloudflare Pages project `hr-jebar`)
- **POS Lite** — ระบบขายหน้าร้านแบบ offline-first
- **Stack:** React + Supabase + Cloudflare

## 2. Stack & Data
- ข้อมูลกลางอยู่ที่ Supabase table `public.jebar_app_state` (`shop_code = 'jebar'`, field `db`)
- ใช้ key กลางให้ตรงทุกระบบ: `db.menus[].id`, `db.ingredients[].id` (ดู `DATA_CONTRACT.md`)
- ❌ ห้าม commit API key / anon key / token ลง repo — ใช้ secret/env เท่านั้น

## 3. งานเชื่อม HR → Operate (มี contract แล้ว)
HR ส่งพนักงานเข้าไปทำงานสต็อกใน Operate ผ่าน **URL query string** (ไม่ต้องเขียน API ใหม่):

```jsx
// ปุ่มในแอป HR สำหรับพนักงาน
function OpenOperateButton({ employee, branch }) {
  const url = new URL('https://je-bar-operate.pages.dev/');
  url.searchParams.set('mode', 'employee');
  url.searchParams.set('emp_id', employee.id);
  url.searchParams.set('emp_name', employee.name);
  url.searchParams.set('branch', branch);
  url.searchParams.set('from_hr', '1');
  return (
    <button onClick={() => window.open(url.toString(), '_blank')}>
      เปิดระบบสต็อก
    </button>
  );
}
```

พารามิเตอร์ที่ต้องส่ง:
| Parameter | ค่า | บังคับ |
|-----------|-----|--------|
| `mode` | `employee` | ✅ |
| `emp_id` | รหัสพนักงาน | ✅ |
| `emp_name` | ชื่อพนักงาน (URL-encode) | แนะนำ |
| `branch` | ชื่อสาขา | แนะนำ |
| `from_hr` | `1` | แนะนำ |

> ฝั่ง Operate รับเอง stamp `createdBy: empId` ให้อัตโนมัติ — HR ไม่ต้องทำอะไรเพิ่มนอกจากส่ง URL

## 4. ข้อมูลที่ไหลกลับเข้า Supabase (พนักงานทำผ่าน Operate)
- บิลซื้อของ → `db.integrationInbox[]`
- ความเคลื่อนไหวสต็อก → `db.stockMovements[]` (receive / waste / adjust / production)
- บันทึกผลิต → `db.productionEvents[]`
- รับซื้อวัตถุดิบ → `db.purchaseEvents[]`

HR Admin ดูข้อมูลพวกนี้ได้จาก Supabase (`jebar_app_state.db.*`) — ใช้ field พวกนี้ทำหน้ารายงาน/ตรวจสอบของพนักงานได้

## 5. POS Lite (offline-first)
- ต้องขายได้แม้เน็ตหลุด → เก็บ local ก่อน แล้ว sync ขึ้น Supabase เมื่อมีเน็ต
- ยอดขายที่ได้ ส่งเข้าโครงสร้างกลาง (sales) ให้ Dashboard/AI ฝั่ง Operate ใช้ต่อได้
- ใช้ key กลางเดียวกัน (`db.menus[].id`) เพื่อให้ยอดขายผูกกับเมนูถูกตัว

## 6. กฎประสานงาน
- จะเปลี่ยนโครงสร้างข้อมูลกลาง / field ใน `db.*` → **เปิด Issue ที่ `jebar-contracts` ก่อน** + เขียน CHANGELOG
- ห้ามทับ master data (menus · สูตร · ingredients · รูป) — เขียนได้เฉพาะ stock/operation/sales zone
- งานของคุณ commit ใน repo ของ HR/POS เท่านั้น ไม่แตะ repo อื่น

## 7. ⚠️ เรื่องต้องเคลียร์ก่อน
ตอนนี้ HR-JEBAR deploy จากเครื่อง local (`C:\...\HR-JEBAR\app`) ไป Cloudflare ตรงๆ
**แนะนำให้ขึ้น GitHub repo** (เช่น `numjebar/hr-jebar`) เพื่อให้แก้/ตรวจ/ย้อนเวอร์ชันได้ปลอดภัย
ถ้ายังไม่มี repo ให้สร้างแบบเดียวกับ `jebar-contracts`

เริ่มจาก: (1) ขึ้น HR เป็น GitHub repo (2) ทำปุ่ม OpenOperateButton ให้พนักงาน (3) วางโครง POS Lite offline-first
ขอบคุณครับ 🙏
