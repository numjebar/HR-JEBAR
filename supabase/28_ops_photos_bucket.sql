-- ─── OPS Photos Bucket ─────────────────────────────────────────────────────
-- รัน 1 ครั้งใน Supabase SQL Editor
-- สร้าง Storage bucket สำหรับรูปที่พนักงานแนบใน OPS forms

-- สร้าง bucket (public = ดูได้โดยไม่ต้องล็อกอิน)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ops-photos',
  'ops-photos',
  true,
  10485760,  -- 10 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: ดูรูปได้ทุกคน (public bucket)
DROP POLICY IF EXISTS "ops-photos public read" ON storage.objects;
CREATE POLICY "ops-photos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ops-photos');

-- Policy: อัปโหลดได้โดยไม่ต้อง login (anon key = พนักงานใช้ PIN login)
DROP POLICY IF EXISTS "ops-photos anon upload" ON storage.objects;
CREATE POLICY "ops-photos anon upload"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'ops-photos');

-- Policy: ลบได้โดยไม่ต้อง login (เผื่ออนาคต)
DROP POLICY IF EXISTS "ops-photos anon delete" ON storage.objects;
CREATE POLICY "ops-photos anon delete"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'ops-photos');
