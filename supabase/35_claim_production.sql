-- ============================================================================
-- 35_claim_production.sql
-- รับผลผลิตเข้าสต็อกแบบ atomic + กันรับซ้ำที่ระดับ DB
-- เป็น "บัญชีกลางร่วม" ระหว่างแอปพนักงาน (HR) และ Operate — กดรับหน้าไหนก็ได้ ตรงกันทุกที่
-- วางใน Supabase SQL Editor ครั้งเดียว (รันซ้ำได้ ปลอดภัย)
-- ============================================================================

-- 1) กันรับ entry การผลิตเดียวกันซ้ำ "ต่อสาขา" — idempotency ระดับ DB
CREATE UNIQUE INDEX IF NOT EXISTS cake_stock_log_prod_claim_uniq
  ON public.cake_stock_log (note, branch_id)
  WHERE action = 'production_claim';

-- 2) RPC: รับผลผลิตของ 1 entry เข้าสต็อกของ 1 สาขา (atomic, relative, idempotent)
CREATE OR REPLACE FUNCTION public.claim_production(
  p_entry_id   text,
  p_branch_id  uuid,
  p_actor_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry        public.employee_ops_entries;
  v_payload      jsonb;
  v_product      text;
  v_qty          numeric;
  v_item         public.cake_items;
  v_branch_label text;
  v_new_qty      numeric;
  v_emp_id       uuid;
  v_inserted     integer := 0;
BEGIN
  -- หา entry การผลิต
  SELECT * INTO v_entry FROM public.employee_ops_entries
    WHERE id::text = p_entry_id AND task_key = 'production';
  IF v_entry.id IS NULL THEN
    RAISE EXCEPTION 'production entry not found: %', p_entry_id;
  END IF;

  v_payload := coalesce(v_entry.payload, '{}'::jsonb);
  v_product := btrim(coalesce(v_payload->>'product', ''));
  IF v_product = '' THEN RAISE EXCEPTION 'entry has no product'; END IF;

  -- หา cake_item ตามชื่อ (เทียบแบบไม่สนตัวพิมพ์/ช่องว่าง)
  SELECT * INTO v_item FROM public.cake_items
    WHERE org_id = v_entry.org_id
      AND lower(replace(btrim(name), ' ', '')) = lower(replace(v_product, ' ', ''))
    LIMIT 1;
  IF v_item.id IS NULL THEN
    RAISE EXCEPTION 'cake_item not found for product: %', v_product;
  END IF;

  -- ยอดที่ส่งให้สาขานี้ จาก payload.dispatches; ถ้าไม่มี ใช้ quantity รวม (รายการเก่า)
  SELECT label INTO v_branch_label FROM public.branches WHERE id = p_branch_id;

  IF jsonb_typeof(v_payload->'dispatches') = 'array' THEN
    SELECT (d->>'qty')::numeric INTO v_qty
      FROM jsonb_array_elements(v_payload->'dispatches') d
      WHERE lower(replace(btrim(coalesce(d->>'branchName', d->>'branch_name', d->>'branch', '')), ' ', ''))
          = lower(replace(btrim(coalesce(v_branch_label, '')), ' ', ''))
      LIMIT 1;
  END IF;
  IF v_qty IS NULL THEN
    v_qty := coalesce((v_payload->>'quantity')::numeric, 0);
  END IF;
  IF v_qty IS NULL OR v_qty <= 0 THEN
    RAISE EXCEPTION 'no dispatch qty for branch %', coalesce(v_branch_label, p_branch_id::text);
  END IF;

  v_emp_id := v_entry.emp_id;

  -- จอง claim ก่อน (unique index กันซ้ำ/กัน race) — ถ้าซ้ำจะ DO NOTHING
  INSERT INTO public.cake_stock_log
    (org_id, branch_id, item_id, item_name, emp_id, emp_name, action, delta, qty_after, note)
  VALUES
    (v_entry.org_id, p_branch_id, v_item.id, v_product, v_emp_id,
     coalesce(p_actor_name, 'ระบบ'), 'production_claim', v_qty, 0, p_entry_id)
  ON CONFLICT (note, branch_id) WHERE action = 'production_claim' DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted = 0 THEN
    -- เคยรับไปแล้ว — คืนยอดปัจจุบัน ไม่บวกซ้ำ
    SELECT qty INTO v_new_qty FROM public.cake_stock
      WHERE branch_id = p_branch_id AND item_id = v_item.id;
    RETURN jsonb_build_object('ok', true, 'already', true, 'qty', coalesce(v_new_qty, 0));
  END IF;

  -- บวกสต็อกแบบ relative (atomic — กัน lost update)
  INSERT INTO public.cake_stock (org_id, branch_id, item_id, qty, updated_by, updated_at)
  VALUES (v_entry.org_id, p_branch_id, v_item.id, v_qty, v_emp_id, now())
  ON CONFLICT (branch_id, item_id)
    DO UPDATE SET qty = public.cake_stock.qty + EXCLUDED.qty,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now()
  RETURNING qty INTO v_new_qty;

  -- อัปเดต qty_after ใน log ที่เพิ่งจอง
  UPDATE public.cake_stock_log
    SET qty_after = v_new_qty
    WHERE action = 'production_claim' AND note = p_entry_id AND branch_id = p_branch_id;

  RETURN jsonb_build_object('ok', true, 'already', false, 'qty', v_new_qty, 'received', v_qty);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_production(text, uuid, text) TO anon, authenticated;
