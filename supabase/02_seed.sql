-- ═══════════════════════════════════════════════════════════════
-- HR JEBAR — Seed Data สำหรับทดสอบ
-- รันหลังจาก 01_schema.sql
-- ═══════════════════════════════════════════════════════════════

-- 1. สร้าง org
insert into orgs (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'ร้าน JEBAR Demo')
on conflict do nothing;

-- 2. สร้าง org_settings
insert into org_settings (org_id, rules, shop_rules) values (
  '00000000-0000-0000-0000-000000000001',
  '{
    "workStart": "09:00", "workEnd": "18:00", "workHours": 8, "graceMin": 5,
    "lateMode": "tiered", "lateBigMin": 30, "lateMinorMin": 15, "lateMinorCount": 3, "lateDeductHours": 1,
    "lateDeductPerMin": 2, "otMode": "multiplier", "otMultiplier": 1.5, "otRatePerHour": 80,
    "ssMode": "percent", "ssPercent": 5, "ssMax": 750, "ssAmount": 750,
    "urgentLeaveDeductDays": 2, "geoEnabled": true, "requireSelfie": true
  }'::jsonb,
  ARRAY[
    'เข้างานตรงเวลา 09:00 น. ผ่อนผันได้ไม่เกิน 5 นาที',
    'มาสายเกิน 15 นาที สะสมครบ 3 ครั้ง หักเงิน 1 ชั่วโมง',
    'มาสายเกิน 30 นาที หักเงิน 1 ชั่วโมงทันที',
    'ลากิจ/ลาป่วย แจ้งล่วงหน้าผ่านแอปก่อนเวลางาน',
    'ทำสินค้า/อุปกรณ์เสียหาย หักตามมูลค่าจริง',
    'แต่งกายสุภาพเรียบร้อย ห้ามใช้โทรศัพท์ขณะให้บริการลูกค้า'
  ]
) on conflict do nothing;

-- 3. สร้าง branches
insert into branches (id, org_id, label, lat, lng, radius, rules, shop_rules) values
(
  '00000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-000000000001',
  'สาขาสยาม', 13.7466, 100.5347, 20,
  '{"workStart":"09:00","workEnd":"18:00","graceMin":5,"lateMode":"tiered","lateBigMin":30,"lateMinorMin":15,"lateMinorCount":3,"lateDeductHours":1,"otMode":"multiplier","otMultiplier":1.5,"ssMode":"percent","ssPercent":5,"ssMax":750}'::jsonb,
  ARRAY['เข้างาน 09:00 น.', 'มาสายเกิน 30 นาที หักทันที', 'ทำเช็กลิสต์ปิดร้านให้ครบ']
),
(
  '00000000-0000-0000-0000-000000000012',
  '00000000-0000-0000-0000-000000000001',
  'สาขาลาดพร้าว', 13.8160, 100.5610, 20,
  '{"workStart":"10:00","workEnd":"19:00","graceMin":10,"lateMode":"permin","lateDeductPerMin":3,"otMode":"multiplier","otMultiplier":1.25,"ssMode":"percent","ssPercent":5,"ssMax":750}'::jsonb,
  ARRAY['เข้างาน 10:00 น. ผ่อนผัน 10 นาที', 'มาสายหักนาทีละ 3 บาท', 'ตรวจเช็ครถก่อนคืนกะ']
) on conflict do nothing;

-- ════════════════════════════════════════════════════════════════
-- หมายเหตุ: สำหรับ employees และ admin ต้องสร้างผ่าน Supabase Auth ก่อน
-- ดูคำแนะนำใน SETUP_GUIDE.md
-- ════════════════════════════════════════════════════════════════
