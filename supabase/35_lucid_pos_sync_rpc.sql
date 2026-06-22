-- ═══════════════════════════════════════════════════════════════
-- LUCID POS Sync Batch RPC v1
-- Depends on: 33_lucid_pos_saas_foundation.sql, 34_lucid_onboarding_device_rpc.sql
-- Purpose: receive offline POS local sync_queue events and persist orders
-- ═══════════════════════════════════════════════════════════════

create or replace function lucid_sync_pos_events(
  p_tenant_id uuid,
  p_events jsonb
)
returns table (
  local_event_id text,
  status text,
  cloud_ref uuid,
  error text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_event jsonb;
  v_payload jsonb;
  v_order jsonb;
  v_payment jsonb;
  v_item jsonb;
  v_customer jsonb;
  v_local_event_id text;
  v_store_id uuid;
  v_device_id uuid;
  v_customer_id uuid;
  v_order_id uuid;
  v_local_order_id text;
  v_order_total numeric;
  v_payment_local_id text;
  v_error text;
begin
  if not lucid_can_access_tenant(p_tenant_id) then
    raise exception 'Not allowed';
  end if;

  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    raise exception 'p_events must be a JSON array';
  end if;

  for v_event in select value from jsonb_array_elements(p_events)
  loop
    v_local_event_id := null;
    v_store_id := null;
    v_device_id := null;
    v_local_order_id := null;
    v_order_id := null;

    begin
      v_local_event_id := coalesce(v_event->>'localEventId', v_event->>'local_event_id');
      v_payload := coalesce(v_event->'payload', '{}'::jsonb);
      v_order := coalesce(v_payload->'order', '{}'::jsonb);
      v_customer := v_payload->'customer';
      v_store_id := nullif(coalesce(v_order->>'storeId', v_event->>'storeId'), '')::uuid;
      v_device_id := nullif(coalesce(v_order->>'deviceId', v_event->>'deviceId'), '')::uuid;
      v_local_order_id := v_order->>'localOrderId';
      v_order_total := coalesce(nullif(v_order->>'total', '')::numeric, 0);

      if v_local_event_id is null then
        raise exception 'Missing localEventId';
      end if;
      if v_device_id is null then
        raise exception 'Missing deviceId';
      end if;
      if v_local_order_id is null then
        raise exception 'Missing order.localOrderId';
      end if;
      if v_store_id is not null and not exists (
        select 1 from stores s where s.id = v_store_id and s.tenant_id = p_tenant_id and s.active = true
      ) then
        raise exception 'Store does not belong to tenant or is inactive';
      end if;
      if not exists (
        select 1 from devices d where d.id = v_device_id and d.tenant_id = p_tenant_id and d.status = 'active'
      ) then
        raise exception 'Device does not belong to tenant or is inactive';
      end if;

      insert into sync_queue (
        tenant_id,
        store_id,
        device_id,
        local_event_id,
        entity_type,
        operation,
        payload,
        status,
        retry_count,
        processed_at,
        updated_at
      )
      values (
        p_tenant_id,
        v_store_id,
        v_device_id,
        v_local_event_id,
        coalesce(v_event->>'entityType', 'order'),
        coalesce(v_event->>'operation', 'upsert'),
        v_payload,
        'processing',
        coalesce(nullif(v_event->>'retryCount', '')::int, 0),
        now(),
        now()
      )
      on conflict (tenant_id, device_id, local_event_id) do update set
        store_id = excluded.store_id,
        payload = excluded.payload,
        status = 'processing',
        retry_count = excluded.retry_count,
        last_error = null,
        processed_at = now(),
        updated_at = now();

      v_customer_id := null;
      if v_customer is not null and jsonb_typeof(v_customer) = 'object' and nullif(v_customer->>'phone', '') is not null then
        insert into customers (tenant_id, name, phone, email, metadata, updated_at)
        values (
          p_tenant_id,
          nullif(v_customer->>'name', ''),
          nullif(v_customer->>'phone', ''),
          nullif(v_customer->>'email', ''),
          jsonb_build_object('localCustomerId', v_customer->>'localCustomerId'),
          now()
        )
        on conflict (tenant_id, phone) do update set
          name = coalesce(excluded.name, customers.name),
          email = coalesce(excluded.email, customers.email),
          metadata = customers.metadata || excluded.metadata,
          updated_at = now()
        returning id into v_customer_id;
      end if;

      insert into orders (
        tenant_id,
        store_id,
        customer_id,
        device_id,
        local_order_id,
        order_no,
        status,
        subtotal,
        discount,
        tax,
        total,
        paid_at,
        local_created_at,
        synced_at,
        metadata,
        updated_at
      )
      values (
        p_tenant_id,
        v_store_id,
        v_customer_id,
        v_device_id,
        v_local_order_id,
        nullif(v_order->>'orderNo', ''),
        coalesce(nullif(v_order->>'status', '')::lucid_order_status, 'paid'),
        coalesce(nullif(v_order->>'subtotal', '')::numeric, v_order_total),
        coalesce(nullif(v_order->>'discount', '')::numeric, 0),
        coalesce(nullif(v_order->>'tax', '')::numeric, 0),
        v_order_total,
        coalesce(nullif(v_order->>'paidAt', '')::timestamptz, now()),
        coalesce(nullif(v_order->>'localCreatedAt', '')::timestamptz, now()),
        now(),
        coalesce(v_order->'metadata', '{}'::jsonb),
        now()
      )
      on conflict (tenant_id, device_id, local_order_id) do update set
        store_id = excluded.store_id,
        customer_id = coalesce(excluded.customer_id, orders.customer_id),
        subtotal = excluded.subtotal,
        discount = excluded.discount,
        tax = excluded.tax,
        total = excluded.total,
        status = excluded.status,
        synced_at = now(),
        metadata = orders.metadata || excluded.metadata,
        updated_at = now()
      returning id into v_order_id;

      delete from order_items oi where oi.order_id = v_order_id;
      for v_item in select value from jsonb_array_elements(coalesce(v_order->'items', '[]'::jsonb))
      loop
        insert into order_items (
          tenant_id,
          order_id,
          product_id,
          name,
          qty,
          unit_price,
          discount,
          total,
          metadata
        )
        values (
          p_tenant_id,
          v_order_id,
          nullif(v_item->>'productId', '')::uuid,
          coalesce(nullif(v_item->>'name', ''), 'Item'),
          coalesce(nullif(v_item->>'qty', '')::numeric, 1),
          coalesce(nullif(v_item->>'unitPrice', '')::numeric, 0),
          coalesce(nullif(v_item->>'discount', '')::numeric, 0),
          coalesce(nullif(v_item->>'total', '')::numeric, 0),
          coalesce(v_item->'metadata', '{}'::jsonb)
        );
      end loop;

      for v_payment in select value from jsonb_array_elements(coalesce(v_payload->'payments', '[]'::jsonb))
      loop
        v_payment_local_id := nullif(v_payment->>'localPaymentId', '');
        if v_payment_local_id is null then
          raise exception 'Missing payment.localPaymentId';
        end if;

        insert into payments (
          tenant_id,
          order_id,
          store_id,
          device_id,
          local_payment_id,
          amount,
          method,
          provider,
          provider_ref,
          paid_at,
          local_created_at,
          synced_at,
          metadata
        )
        values (
          p_tenant_id,
          v_order_id,
          v_store_id,
          v_device_id,
          v_payment_local_id,
          coalesce(nullif(v_payment->>'amount', '')::numeric, v_order_total),
          coalesce(nullif(v_payment->>'method', '')::lucid_payment_method, 'cash'),
          nullif(v_payment->>'provider', ''),
          nullif(v_payment->>'providerRef', ''),
          coalesce(nullif(v_payment->>'paidAt', '')::timestamptz, now()),
          coalesce(nullif(v_payment->>'localCreatedAt', '')::timestamptz, now()),
          now(),
          coalesce(v_payment->'metadata', '{}'::jsonb)
        )
        on conflict (tenant_id, device_id, local_payment_id) do update set
          order_id = excluded.order_id,
          store_id = excluded.store_id,
          amount = excluded.amount,
          method = excluded.method,
          provider = excluded.provider,
          provider_ref = excluded.provider_ref,
          paid_at = excluded.paid_at,
          synced_at = now(),
          metadata = payments.metadata || excluded.metadata;
      end loop;

      update sync_queue sq
      set status = 'synced', processed_at = now(), last_error = null, updated_at = now()
      where sq.tenant_id = p_tenant_id
        and sq.device_id = v_device_id
        and sq.local_event_id = v_local_event_id;

      update devices d
      set last_seen_at = now(), updated_at = now()
      where d.id = v_device_id and d.tenant_id = p_tenant_id;

      insert into business_events (tenant_id, store_id, event_type, payload)
      values (
        p_tenant_id,
        v_store_id,
        'pos_order_synced',
        jsonb_build_object('localEventId', v_local_event_id, 'localOrderId', v_local_order_id, 'orderId', v_order_id)
      );

      local_event_id := v_local_event_id;
      status := 'synced';
      cloud_ref := v_order_id;
      error := null;
      return next;
    exception when others then
      v_error := sqlerrm;
      if v_local_event_id is not null and v_device_id is not null then
        update sync_queue sq
        set status = 'failed', retry_count = retry_count + 1, last_error = v_error, processed_at = now(), updated_at = now()
        where sq.tenant_id = p_tenant_id
          and sq.device_id = v_device_id
          and sq.local_event_id = v_local_event_id;
      end if;

      local_event_id := v_local_event_id;
      status := 'failed';
      cloud_ref := null;
      error := v_error;
      return next;
    end;
  end loop;
end;
$$;

grant execute on function lucid_sync_pos_events(uuid, jsonb) to authenticated;
