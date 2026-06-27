-- ═══════════════════════════════════════════════════════════════
-- Migration 34: Cake sub-category (bakery grouping)
-- เพิ่มคอลัมน์ category ให้ cake_items เพื่อจัดกลุ่มขนม
--   ค่าที่ใช้: 'cake' (เค้ก) | 'bread' (ขนมปัง) | 'snack' | 'other' (อื่นๆ)
-- ปกติค่าจะ sync มาจาก "หมวดย่อย" ของเมนูใน LUCID Operate (menu.subCategory)
-- ถ้าไม่ระบุ แอปพนักงานจะเดาจากชื่ออัตโนมัติ (guessCategory)
-- รัน 1 ครั้งใน Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE cake_items
  ADD COLUMN IF NOT EXISTS category text;

-- หมายเหตุ: anon update policy "anon update cake_items" (จาก migration 33)
-- ครอบคลุมทุกคอลัมน์อยู่แล้ว (USING true WITH CHECK true)
-- จึงไม่ต้องเพิ่ม policy ใหม่สำหรับ category
