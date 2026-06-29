# DATA CONTRACT — โครงสร้างข้อมูลกลาง JE BAR

> สัญญากลางสำหรับทุกทีม · ห้ามเปลี่ยนโดยไม่ทำตามขั้นตอนใน COORDINATION.md

---

## 1. แหล่งข้อมูล (Connection target)

| รายการ | ค่า |
|--------|-----|
| Base URL | `https://eoinzxqpqbybwcrmsgww.supabase.co` |
| REST pattern | `https://eoinzxqpqbybwcrmsgww.supabase.co/rest/v1/<table>` |
| Table หลัก | `public.jebar_app_state` |
| Filter key | `shop_code` |
| Shop code | `jebar` |
| Field payload หลัก | `db` |

> ⚠️ anon key / service key ไม่อยู่ในเอกสารนี้ — ดึงจาก secret store ของแต่ละทีม ห้าม commit

### Read flow
อ่าน 1 แถว: filter `shop_code = jebar` แล้วเอา field `db` มาใช้ (เป็น JSON ก้อนใหญ่)

### Write flow
เขียนกลับได้ **เฉพาะ stock / operation zone** เท่านั้น
**ห้ามทับ** master data (menus · สูตร · ingredients · รูปหลัก)

---

## 2. Master data ภายใต้ `db`

| path | เนื้อหา | เขียนได้ไหม |
|------|---------|------------|
| `db.menus` | เมนูทั้งหมด | ❌ read-only (master) |
| `db.ingredients` | วัตถุดิบ + วัสดุสิ้นเปลือง | ❌ read-only (master) |
| `db.packages` | แพ็กเกจ/บรรจุภัณฑ์ | ❌ read-only |
| `db.recipeBase` | สูตรเมนูตรง | ❌ read-only |
| `db.batchRecipes` | สูตรเบเกอรี่ฐาน | ❌ read-only |
| `db.batchRecipeLines` | บรรทัดสูตรเบเกอรี่ฐาน | ❌ read-only |
| `db.recipeBatch` | ลิงก์เมนู↔batch | ❌ read-only |
| `db.mediaAssets` | metadata รูป | ❌ read-only |
| `db.dailySales` | ยอดขายรายวัน | ✅ operation zone |
| `db.menuReports` | รายงานต่อเมนู | ✅ operation zone |
| `db.hourlyReports` | รายงานรายชั่วโมง | ✅ operation zone |
| `db.activityLogs` | log การใช้งาน | ✅ append เท่านั้น |

> stock zone อื่น ๆ ที่อีกแอปเขียนกลับได้ ให้ระบุเพิ่มเมื่อมีการตกลง (ผ่าน Issue + CHANGELOG)

---

## 3. 🔑 Key กลาง (ห้ามแก้รูปแบบ)

กุญแจเชื่อมทุกระบบ — ทุกทีมต้องอ้างอิงให้ตรงกัน:

| ข้อมูลกลาง (DATA) | ฝั่ง OPS / ทีมอื่น |
|-------------------|--------------------|
| `db.ingredients[].id` | `ingredients.code` |
| `db.menus[].id` | `recipes.code` |

---

## 4. วัสดุสิ้นเปลือง (Supplies)

เก็บเป็น master ใน `db.ingredients` ด้วย แนะนำใช้ code `SUP001`, `SUP002`, ...
ตัวอย่าง: น้ำยาล้างจาน · ทิชชู่ · น้ำยาถูพื้น · ถุงขยะ · ถุงมือ · ฝาแก้ว · หลอด

---

## 5. หมายเหตุ storage

- ฝั่ง DATA app เก็บใน browser localStorage (`jebar_db_v1`, `jebar_settings_v1`)
  แล้ว sync ขึ้น Supabase — แต่ทีมอื่น **อ่านจาก Supabase เท่านั้น** ไม่ต้องยุ่ง localStorage
- รายละเอียด API เต็ม ดูไฟล์ต้นทางใน repo `JE-BAR-Operate`:
  `OPS_API_CONTRACT_JEBAR.md`, `JEBAR_DIRECT_SUPABASE_API.md`, `DATA_STORAGE_MAP.md`
