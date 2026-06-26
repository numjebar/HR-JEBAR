-- ═══════════════════════════════════════════════════════════════
-- Migration 33: Catalog Feature
-- 1. Fix branches anon-read (PIN-login employees use anon key)
-- 2. Add photo_url + price to cake_items
-- 3. Create catalog_sessions table (public shareable links)
-- 4. RLS for catalog_sessions + public reads
-- รัน 1 ครั้งใน Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Fix branches: allow anon read ─────────────────────────────────────────
-- Employees log in via PIN (anon key), so the previous policy blocked them.
DROP POLICY IF EXISTS "anon read branches" ON branches;
CREATE POLICY "anon read branches" ON branches
  FOR SELECT TO anon USING (true);

-- ── 2. cake_items: add photo_url and price ────────────────────────────────────
ALTER TABLE cake_items
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS price     numeric;

-- Allow anon to update photo_url and price (same as is_open toggle)
DROP POLICY IF EXISTS "anon update cake_items" ON cake_items;
CREATE POLICY "anon update cake_items" ON cake_items
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ── 3. catalog_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS catalog_sessions (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id     uuid        NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  branch_id  uuid        REFERENCES branches(id) ON DELETE SET NULL,
  created_by text,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE catalog_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read a catalog session (needed for public catalog page)
DROP POLICY IF EXISTS "public read catalog_sessions" ON catalog_sessions;
CREATE POLICY "public read catalog_sessions" ON catalog_sessions
  FOR SELECT USING (true);

-- Anon can insert (employees create catalog links)
DROP POLICY IF EXISTS "anon insert catalog_sessions" ON catalog_sessions;
CREATE POLICY "anon insert catalog_sessions" ON catalog_sessions
  FOR INSERT TO anon WITH CHECK (true);

-- ── 4. Public read for cake_items and cake_stock ──────────────────────────────
-- (needed so the public /catalog/:token page can read them)

DROP POLICY IF EXISTS "anon read cake_items" ON cake_items;
CREATE POLICY "anon read cake_items" ON cake_items
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon read cake_stock" ON cake_stock;
CREATE POLICY "anon read cake_stock" ON cake_stock
  FOR SELECT TO anon USING (true);
