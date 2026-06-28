-- ============================================================================
-- 36_cake_stock_rpc.sql
-- เฟส 2 รวมข้อมูล: ปรับสต็อกเค้กผ่าน RPC เท่านั้น (ห้ามเขียน qty ตรงจาก client)
-- ทุกการเปลี่ยนเป็น event (log) + อัปเดตยอดแบบ atomic — ตรงกฎ "ห้าม update stock โดยตรง"
-- วางใน Supabase SQL Editor ครั้งเดียว (รันซ้ำได้ ปลอดภัย)
-- ============================================================================

-- ปรับแบบ relative: qty += delta (หรือ qty_spoiled += delta ถ้า p_spoiled = true)
CREATE OR REPLACE FUNCTION public.adjust_cake_stock(
  p_branch_id  uuid,
  p_item_id    uuid,
  p_delta      numeric,
  p_action     text    DEFAULT 'adjust',
  p_actor_id   uuid    DEFAULT NULL,
  p_actor_name text    DEFAULT NULL,
  p_note       text    DEFAULT NULL,
  p_spoiled    boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item public.cake_items;
  v_new  numeric;
BEGIN
  SELECT * INTO v_item FROM public.cake_items WHERE id = p_item_id;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'cake_item not found: %', p_item_id; END IF;

  IF p_spoiled THEN
    INSERT INTO public.cake_stock (org_id, branch_id, item_id, qty_spoiled, updated_by, updated_at)
      VALUES (v_item.org_id, p_branch_id, p_item_id, GREATEST(0, p_delta), p_actor_id, now())
    ON CONFLICT (branch_id, item_id) DO UPDATE
      SET qty_spoiled = GREATEST(0, coalesce(public.cake_stock.qty_spoiled, 0) + p_delta),
          updated_by = p_actor_id, updated_at = now()
    RETURNING qty_spoiled INTO v_new;
  ELSE
    INSERT INTO public.cake_stock (org_id, branch_id, item_id, qty, updated_by, updated_at)
      VALUES (v_item.org_id, p_branch_id, p_item_id, GREATEST(0, p_delta), p_actor_id, now())
    ON CONFLICT (branch_id, item_id) DO UPDATE
      SET qty = GREATEST(0, coalesce(public.cake_stock.qty, 0) + p_delta),
          updated_by = p_actor_id, updated_at = now()
    RETURNING qty INTO v_new;
  END IF;

  INSERT INTO public.cake_stock_log
    (org_id, branch_id, item_id, item_name, emp_id, emp_name, action, delta, qty_after, note)
  VALUES
    (v_item.org_id, p_branch_id, p_item_id, v_item.name, p_actor_id,
     coalesce(p_actor_name, 'ระบบ'), coalesce(p_action, 'adjust'), p_delta, v_new, p_note);

  RETURN jsonb_build_object(
    'ok', true, 'spoiled', p_spoiled,
    'qty',         CASE WHEN p_spoiled THEN NULL ELSE v_new END,
    'qty_spoiled', CASE WHEN p_spoiled THEN v_new ELSE NULL END);
END; $$;
GRANT EXECUTE ON FUNCTION public.adjust_cake_stock(uuid, uuid, numeric, text, uuid, text, text, boolean) TO anon, authenticated;

-- ตั้งค่าแบบ absolute: qty = target (log delta = target - ยอดปัจจุบัน) — สำหรับช่อง "นับได้เท่าไร" / ดึงจาก Operate
CREATE OR REPLACE FUNCTION public.set_cake_stock(
  p_branch_id  uuid,
  p_item_id    uuid,
  p_target     numeric,
  p_actor_id   uuid  DEFAULT NULL,
  p_actor_name text  DEFAULT NULL,
  p_note       text  DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_item   public.cake_items;
  v_prev   numeric;
  v_target numeric := GREATEST(0, round(coalesce(p_target, 0)));
  v_delta  numeric;
  v_new    numeric;
BEGIN
  SELECT * INTO v_item FROM public.cake_items WHERE id = p_item_id;
  IF v_item.id IS NULL THEN RAISE EXCEPTION 'cake_item not found: %', p_item_id; END IF;

  SELECT coalesce(qty, 0) INTO v_prev FROM public.cake_stock
    WHERE branch_id = p_branch_id AND item_id = p_item_id;
  v_prev  := coalesce(v_prev, 0);
  v_delta := v_target - v_prev;

  INSERT INTO public.cake_stock (org_id, branch_id, item_id, qty, updated_by, updated_at)
    VALUES (v_item.org_id, p_branch_id, p_item_id, v_target, p_actor_id, now())
  ON CONFLICT (branch_id, item_id) DO UPDATE
    SET qty = v_target, updated_by = p_actor_id, updated_at = now()
  RETURNING qty INTO v_new;

  INSERT INTO public.cake_stock_log
    (org_id, branch_id, item_id, item_name, emp_id, emp_name, action, delta, qty_after, note)
  VALUES
    (v_item.org_id, p_branch_id, p_item_id, v_item.name, p_actor_id,
     coalesce(p_actor_name, 'ระบบ'), 'adjust', v_delta, v_new, p_note);

  RETURN jsonb_build_object('ok', true, 'qty', v_new, 'delta', v_delta);
END; $$;
GRANT EXECUTE ON FUNCTION public.set_cake_stock(uuid, uuid, numeric, uuid, text, text) TO anon, authenticated;
