-- ═══════════════════════════════════════════════════════════════
-- LUCID Onboarding + Device License RPC v1
-- Depends on: 33_lucid_pos_saas_foundation.sql
-- Purpose: create tenant/store/user/subscription/wallet after OTP/auth,
-- then register and renew offline-first POS device licenses.
-- ═══════════════════════════════════════════════════════════════

create or replace function lucid_register_tenant(
  p_store_name text,
  p_owner_name text,
  p_phone text,
  p_email text,
  p_store_type lucid_store_type default 'other',
  p_plan_code lucid_plan_code default 'pos_lite',
  p_branch_count int default 1,
  p_import_sources jsonb default '[]'::jsonb
)
returns table (
  tenant_id uuid,
  store_id uuid,
  org_id uuid,
  subscription_id uuid,
  wallet_id uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_org_id uuid;
  v_tenant_id uuid;
  v_store_id uuid;
  v_plan_id uuid;
  v_subscription_id uuid;
  v_tenant_user_id uuid;
  v_wallet_id uuid;
  v_safe_branch_count int := greatest(1, coalesce(p_branch_count, 1));
begin
  if v_auth_user_id is null then
    raise exception 'Authentication required';
  end if;

  if nullif(trim(p_store_name), '') is null then
    raise exception 'Store name is required';
  end if;

  insert into orgs (name)
  values (trim(p_store_name))
  returning id into v_org_id;

  insert into admin_roles (auth_user_id, org_id)
  values (v_auth_user_id, v_org_id)
  on conflict (auth_user_id, org_id) do nothing;

  insert into tenants (
    org_id,
    name,
    owner_name,
    phone,
    email,
    store_type,
    onboarding,
    settings
  ) values (
    v_org_id,
    trim(p_store_name),
    nullif(trim(coalesce(p_owner_name, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), ''),
    coalesce(p_store_type, 'other'),
    jsonb_build_object(
      'branchCount', v_safe_branch_count,
      'importSources', coalesce(p_import_sources, '[]'::jsonb),
      'completedSteps', jsonb_build_array('tenant', 'store', 'owner', 'subscription', 'wallet')
    ),
    jsonb_build_object('offlineFirst', true, 'cloudManagement', true)
  ) returning id into v_tenant_id;

  insert into stores (tenant_id, name, code, store_type, phone, metadata)
  values (
    v_tenant_id,
    trim(p_store_name),
    'MAIN',
    coalesce(p_store_type, 'other'),
    nullif(trim(coalesce(p_phone, '')), ''),
    jsonb_build_object('isMain', true, 'onboardingBranchCount', v_safe_branch_count)
  ) returning id into v_store_id;

  insert into tenant_users (tenant_id, auth_user_id, role, display_name, phone, email)
  values (
    v_tenant_id,
    v_auth_user_id,
    'owner',
    nullif(trim(coalesce(p_owner_name, '')), ''),
    nullif(trim(coalesce(p_phone, '')), ''),
    nullif(lower(trim(coalesce(p_email, ''))), '')
  )
  on conflict (tenant_id, auth_user_id) do update set
    role = 'owner',
    active = true,
    display_name = coalesce(excluded.display_name, tenant_users.display_name),
    phone = coalesce(excluded.phone, tenant_users.phone),
    email = coalesce(excluded.email, tenant_users.email)
  returning id into v_tenant_user_id;

  select id into v_plan_id
  from plans
  where code = coalesce(p_plan_code, 'pos_lite')
  limit 1;

  if v_plan_id is null then
    raise exception 'Plan not found: %', coalesce(p_plan_code::text, 'pos_lite');
  end if;

  insert into subscriptions (
    tenant_id,
    plan_id,
    status,
    billing_cycle,
    current_period_start,
    current_period_end,
    metadata
  ) values (
    v_tenant_id,
    v_plan_id,
    'trialing',
    'monthly',
    current_date,
    current_date + 14,
    jsonb_build_object('source', 'onboarding')
  ) returning id into v_subscription_id;

  insert into credit_wallets (tenant_id, balance)
  values (v_tenant_id, 0)
  on conflict (tenant_id) do update set updated_at = now()
  returning id into v_wallet_id;

  insert into business_events (tenant_id, store_id, event_type, payload)
  values (
    v_tenant_id,
    v_store_id,
    'tenant_registered',
    jsonb_build_object('ownerUserId', v_auth_user_id, 'planCode', p_plan_code, 'storeType', p_store_type)
  );

  tenant_id := v_tenant_id;
  store_id := v_store_id;
  org_id := v_org_id;
  subscription_id := v_subscription_id;
  wallet_id := v_wallet_id;
  return next;
end;
$$;

create or replace function lucid_register_device(
  p_tenant_id uuid,
  p_store_id uuid,
  p_device_name text,
  p_platform text default 'web',
  p_license_days int default 7,
  p_printer_profile jsonb default '{}'::jsonb
)
returns table (
  device_id uuid,
  device_token text,
  license_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_device_id uuid;
  v_device_token text := encode(gen_random_bytes(32), 'hex');
  v_token_hash text := encode(digest(v_device_token, 'sha256'), 'hex');
  v_license_days int := least(30, greatest(1, coalesce(p_license_days, 7)));
  v_expires_at timestamptz := now() + make_interval(days => least(30, greatest(1, coalesce(p_license_days, 7))));
begin
  if not lucid_can_access_tenant(p_tenant_id) then
    raise exception 'Not allowed';
  end if;

  if p_store_id is not null and not exists (
    select 1 from stores s where s.id = p_store_id and s.tenant_id = p_tenant_id and s.active = true
  ) then
    raise exception 'Store does not belong to tenant or is inactive';
  end if;

  if nullif(trim(p_device_name), '') is null then
    raise exception 'Device name is required';
  end if;

  insert into devices (
    tenant_id,
    store_id,
    device_name,
    device_token_hash,
    platform,
    printer_profile,
    status,
    license_expires_at,
    last_seen_at
  ) values (
    p_tenant_id,
    p_store_id,
    trim(p_device_name),
    v_token_hash,
    coalesce(nullif(trim(p_platform), ''), 'web'),
    coalesce(p_printer_profile, '{}'::jsonb),
    'active',
    v_expires_at,
    now()
  ) returning id into v_device_id;

  insert into business_events (tenant_id, store_id, event_type, payload)
  values (
    p_tenant_id,
    p_store_id,
    'device_registered',
    jsonb_build_object('deviceId', v_device_id, 'platform', p_platform, 'licenseDays', v_license_days)
  );

  device_id := v_device_id;
  device_token := v_device_token;
  license_expires_at := v_expires_at;
  return next;
end;
$$;

create or replace function lucid_renew_device_license(
  p_tenant_id uuid,
  p_device_id uuid,
  p_device_token text,
  p_license_days int default 7
)
returns table (
  device_id uuid,
  status lucid_device_status,
  license_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_token_hash text := encode(digest(coalesce(p_device_token, ''), 'sha256'), 'hex');
  v_license_days int := least(30, greatest(1, coalesce(p_license_days, 7)));
  v_expires_at timestamptz := now() + make_interval(days => least(30, greatest(1, coalesce(p_license_days, 7))));
  v_store_id uuid;
begin
  update devices d
  set status = 'active',
      license_expires_at = v_expires_at,
      last_seen_at = now(),
      updated_at = now()
  where d.id = p_device_id
    and d.tenant_id = p_tenant_id
    and d.device_token_hash = v_token_hash
    and d.status <> 'blocked'
  returning d.store_id into v_store_id;

  if not found then
    raise exception 'Device license renewal failed';
  end if;

  insert into business_events (tenant_id, store_id, event_type, payload)
  values (
    p_tenant_id,
    v_store_id,
    'device_license_renewed',
    jsonb_build_object('deviceId', p_device_id, 'licenseDays', v_license_days)
  );

  device_id := p_device_id;
  status := 'active';
  license_expires_at := v_expires_at;
  return next;
end;
$$;

grant execute on function lucid_register_tenant(text, text, text, text, lucid_store_type, lucid_plan_code, int, jsonb) to authenticated;
grant execute on function lucid_register_device(uuid, uuid, text, text, int, jsonb) to authenticated;
grant execute on function lucid_renew_device_license(uuid, uuid, text, int) to authenticated;
