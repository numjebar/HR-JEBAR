-- ═══════════════════════════════════════════════════════════════
-- LUCID POS + SaaS Foundation v1
-- Purpose: multi-tenant cloud foundation for offline-first POS, subscription,
-- AI credits, recipes, inventory, orders, sync queue, and audit events.
-- Run after existing HR JEBAR schema migrations.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---- enums -------------------------------------------------------
do $$ begin
  create type lucid_store_type as enum ('coffee', 'restaurant', 'bakery', 'beverage', 'market', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_plan_code as enum ('pos_lite', 'business', 'ai');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'canceled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_device_status as enum ('active', 'expired', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_order_status as enum ('draft', 'paid', 'void', 'refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_payment_method as enum ('cash', 'transfer', 'qr', 'card', 'wallet', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_sync_status as enum ('pending', 'processing', 'synced', 'failed', 'conflict');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lucid_credit_tx_type as enum ('topup', 'usage', 'refund', 'adjustment');
exception when duplicate_object then null; end $$;

-- ---- tenants / stores / users -----------------------------------
create table if not exists tenants (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid references orgs(id) on delete set null,
  name text not null,
  owner_name text,
  phone text,
  email text,
  store_type lucid_store_type not null default 'other',
  onboarding jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists stores (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  code text,
  store_type lucid_store_type not null default 'other',
  address text,
  phone text,
  timezone text not null default 'Asia/Bangkok',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table if not exists tenant_users (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'owner',
  display_name text,
  phone text,
  email text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, auth_user_id)
);

-- ---- subscription / billing -------------------------------------
create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  code lucid_plan_code not null unique,
  name text not null,
  price_daily numeric,
  price_monthly numeric,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_id uuid references plans(id) on delete set null,
  status lucid_subscription_status not null default 'trialing',
  billing_cycle text not null default 'monthly',
  current_period_start date,
  current_period_end date,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  invoice_no text,
  amount numeric not null default 0,
  status text not null default 'draft',
  due_date date,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, invoice_no)
);

create table if not exists billing_payments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  amount numeric not null default 0,
  method text,
  provider text,
  provider_ref text,
  paid_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---- device licensing ------------------------------------------
create table if not exists devices (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  device_name text not null,
  device_token_hash text not null unique,
  platform text,
  printer_profile jsonb not null default '{}'::jsonb,
  status lucid_device_status not null default 'active',
  license_expires_at timestamptz not null default (now() + interval '7 days'),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- catalog / recipe / inventory -------------------------------
create table if not exists categories (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  sku text,
  name text not null,
  description text,
  price numeric not null default 0,
  cost_estimate numeric not null default 0,
  tax_rate numeric not null default 0,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table if not exists ingredients (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  unit text not null default 'unit',
  avg_price numeric not null default 0,
  price_sources jsonb not null default '[]'::jsonb,
  temporary_seed boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, name, unit)
);

create table if not exists recipes (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  yield_qty numeric not null default 1,
  instructions text,
  ai_notes text,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, product_id)
);

create table if not exists recipe_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete set null,
  name text not null,
  qty numeric not null default 0,
  unit text not null default 'unit',
  cost_estimate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists inventory (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete cascade,
  ingredient_id uuid references ingredients(id) on delete cascade,
  qty_on_hand numeric not null default 0,
  min_qty numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique (tenant_id, store_id, ingredient_id)
);

create table if not exists inventory_transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  ingredient_id uuid references ingredients(id) on delete set null,
  qty_delta numeric not null,
  reason text not null,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

-- ---- POS orders / payments / customers --------------------------
create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text,
  phone text,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create table if not exists orders (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  device_id uuid references devices(id) on delete set null,
  local_order_id text,
  order_no text,
  status lucid_order_status not null default 'paid',
  subtotal numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  total numeric not null default 0,
  paid_at timestamptz,
  local_created_at timestamptz,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, device_id, local_order_id)
);

create table if not exists order_items (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid not null references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  name text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0,
  discount numeric not null default 0,
  total numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  store_id uuid references stores(id) on delete set null,
  device_id uuid references devices(id) on delete set null,
  local_payment_id text,
  amount numeric not null default 0,
  method lucid_payment_method not null default 'cash',
  provider text,
  provider_ref text,
  paid_at timestamptz not null default now(),
  local_created_at timestamptz,
  synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, device_id, local_payment_id)
);

-- ---- AI credits / events / sync ---------------------------------
create table if not exists credit_wallets (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade unique,
  balance int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  wallet_id uuid references credit_wallets(id) on delete set null,
  type lucid_credit_tx_type not null,
  amount int not null,
  reason text,
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists sync_queue (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  device_id uuid references devices(id) on delete set null,
  local_event_id text not null,
  entity_type text not null,
  operation text not null default 'upsert',
  payload jsonb not null,
  status lucid_sync_status not null default 'pending',
  retry_count int not null default 0,
  last_error text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, device_id, local_event_id)
);

create table if not exists business_events (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists activity_logs (
  id uuid primary key default uuid_generate_v4(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---- helper / RLS -----------------------------------------------
create or replace function lucid_can_access_tenant(p_tenant_id uuid)
returns boolean language sql security definer set search_path = public, auth as $$
  select exists (
    select 1 from tenant_users tu
    where tu.tenant_id = p_tenant_id
      and tu.auth_user_id = auth.uid()
      and tu.active = true
  )
  or exists (
    select 1 from tenants t
    where t.id = p_tenant_id
      and t.org_id is not null
      and is_admin(t.org_id)
  );
$$;

grant execute on function lucid_can_access_tenant(uuid) to authenticated;

alter table tenants enable row level security;
alter table stores enable row level security;
alter table tenant_users enable row level security;
alter table plans enable row level security;
alter table subscriptions enable row level security;
alter table invoices enable row level security;
alter table billing_payments enable row level security;
alter table devices enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table ingredients enable row level security;
alter table recipes enable row level security;
alter table recipe_items enable row level security;
alter table inventory enable row level security;
alter table inventory_transactions enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table credit_wallets enable row level security;
alter table credit_transactions enable row level security;
alter table sync_queue enable row level security;
alter table business_events enable row level security;
alter table activity_logs enable row level security;

-- Shared tenant policy pattern: tenant member or mapped HR admin can read/write.
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'stores','tenant_users','subscriptions','invoices','billing_payments','devices',
    'categories','products','ingredients','recipes','recipe_items','inventory','inventory_transactions',
    'customers','orders','order_items','payments','credit_wallets','credit_transactions','sync_queue',
    'business_events','activity_logs'
  ] loop
    execute format('drop policy if exists "lucid tenant access" on %I', tbl);
    execute format('create policy "lucid tenant access" on %I for all using (lucid_can_access_tenant(tenant_id)) with check (lucid_can_access_tenant(tenant_id))', tbl);
  end loop;
end $$;

drop policy if exists "lucid tenant access" on tenants;
create policy "lucid tenant access" on tenants for all
  using (lucid_can_access_tenant(id))
  with check (lucid_can_access_tenant(id));

drop policy if exists "plans readable" on plans;
create policy "plans readable" on plans for select using (active = true);

insert into plans (code, name, price_daily, price_monthly, features)
values
  ('pos_lite', 'POS Lite', 29, 790, '["POS", "Receipt", "Offline Mode", "Sync"]'::jsonb),
  ('business', 'Business', null, 990, '["Inventory", "Recipes", "Costing", "Dashboard"]'::jsonb),
  ('ai', 'AI', null, 1990, '["AI Import Menu", "OCR", "AI Advisor", "Forecast"]'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  price_daily = excluded.price_daily,
  price_monthly = excluded.price_monthly,
  features = excluded.features,
  active = true;

create index if not exists idx_lucid_products_tenant_active on products(tenant_id, active);
create index if not exists idx_lucid_orders_tenant_paid_at on orders(tenant_id, paid_at desc);
create index if not exists idx_lucid_sync_queue_status on sync_queue(tenant_id, status, created_at);
create index if not exists idx_lucid_business_events on business_events(tenant_id, event_type, created_at desc);
