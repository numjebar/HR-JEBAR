# 🎂 Catalog Cake — บันทึกการแก้บั๊ก "รูปไม่ขึ้น / แคตตาล็อกว่าง" ✅ แก้จบแล้ว

> โปรเจกต์: **catalog cake** (JE BAR Cake Studio)
> เว็บ: https://jebar-cake.je-bar.workers.dev (หน้าร้าน) · /admin (แอดมิน)
> Supabase project: `eoinzxqpqbybwcrmsgww` (JEBAR DATA)
> Repo: `numjebar/catalog-cake` (Private)
> สถานะ: **RESOLVED** · อัปเดต 14 มิ.ย. 2026

---

## 🔴 อาการเดิม
- อัพรูปเค้กในแคตตาล็อก (แอดมิน) แล้ว **รูปไม่ขึ้น / หาย**, ฝั่งลูกค้าไม่โชว์
- หน้าแคตตาล็อกขึ้น **"ไม่พบเค้ก · แสดง 0 จาก 0"**

---

## 🎯 ต้นเหตุจริง — 3 ชั้นซ้อนกัน

### ชั้นที่ 1 — ตาราง `cake_recipes` ไม่มีในฐานข้อมูล → 404
Console ฟ้อง `cake_recipes?select=* → 404` → แอป fallback ไป sample data
→ **แก้:** สร้างตาราง `cake_recipes` (cakes.id เป็น text จึงตั้ง cake_id เป็น text)

### ชั้นที่ 2 — ฐานข้อมูลว่าง
ตาราง `cakes` / `categories` ยังไม่มีข้อมูล → ขึ้น 0 จาก 0 แม้ deploy แล้ว
→ **แก้:** รัน seed ข้อมูลเข้า Supabase

### ชั้นที่ 3 — localStorage tombstone ซ่อนข้อมูล cloud ⭐ (ตัวการหลัก)
- key **`jebar_deleted_cakes_v1`** ในเครื่องจำว่าเค้ก c01–c12 "ถูกลบแล้ว"
- โค้ดเดิมเอาประวัติการลบนี้มา **กรองข้อมูลที่โหลดจาก Supabase ออก**
- พอ cloud มีเค้ก 12–13 รายการ โหลดมาได้จริง แต่ถูกกรองทิ้ง → เหลือโชว์แค่เค้กใหม่ 1 รายการ
→ **แก้:** ให้ **Supabase เป็น source of truth** — ถ้าโหลด cloud สำเร็จ จะไม่เอา `jebar_deleted_cakes_v1` มาซ่อนข้อมูล cloud อีก

> สรุป: ไม่ใช่ deploy พัง แต่เป็น **DB ว่าง + localStorage เก่าซ่อนข้อมูล cloud**

---

## ✅ สิ่งที่แก้ไปแล้ว
1. สร้างตาราง `cake_recipes` ใน Supabase (+ RLS read/write)
2. Seed ข้อมูลเค้ก/หมวดเข้า Supabase
3. แก้โค้ดให้ cloud catalog ไม่ถูกกรองด้วย `jebar_deleted_cakes_v1` อีกต่อไป
4. เพิ่มฟอร์ม "เพิ่มเค้กใหม่" ในแอดมิน
5. push ขึ้น repo `numjebar/catalog-cake` + deploy แล้ว
6. ✅ รูปขึ้นครบทั้งฝั่งแอดมินและฝั่งลูกค้า

---

## ⚠️ สิ่งที่ทีมควรระวังต่อ
- ❌ **อย่ากด "ลบทั้งหมด" ในแอดมิน** ถ้าไม่ตั้งใจลบข้อมูลจริงจาก Supabase
- 🔁 ถ้าแก้ schema ซ้ำ → ใช้ `drop policy if exists ...` ก่อนสร้าง policy ใหม่ (กัน error "already exists")
- 🚀 ถ้า deploy แล้วเว็บไม่เปลี่ยน → เช็คว่า deploy จาก **GitHub main commit ล่าสุด** จริงไหม + กด Ctrl+Shift+R ล้าง cache
- 🧹 พิจารณาล้าง key `jebar_deleted_cakes_v1` ทิ้งในเครื่องที่เคยใช้ กันสับสน
- 🗑️ ตรวจว่าปุ่ม "ลบเค้ก" ลบออกจาก Supabase จริง (ไม่ใช่แค่ tombstone ใน localStorage) ไม่งั้นเค้กอาจเด้งกลับตอน refresh

---

## 🔐 เก็บงานก่อน production
- [ ] เปลี่ยน RLS จาก `using (true)` → `authenticated only`
- [ ] ลบปุ่ม "เข้าแบบเดโม"
- [ ] ตั้ง CORS เฉพาะ domain ของร้าน
- [ ] เปลี่ยนรหัสผ่าน admin Supabase
- [ ] ลบ `console.log` debug
