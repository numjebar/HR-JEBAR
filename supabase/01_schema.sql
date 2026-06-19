-- ═══════════════════════════════════════════════════════════════
-- HR JEBAR — Supabase Schema + RLS
-- รันใน SQL Editor ของ Supabase (Project → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- ---- extensions --------------------------------------------------
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---- enums -------------------------------------------------------
create type pay_type_enum as enum ('daily', 'monthly');
create type attendance_status_enum as enum ('present', 'late', 'leave', 'absent');
create type leave_status_enum as enum ('pending', 'approved', 'rejected');
create type adj_type_enum as enum ('bonus', 'damage', 'advance', 'other');
create type msg_from_enum as enum ('admin', 'emp');
create type msg_kind_enum as enum ('message', 'task');
create type msg_status_enum as enum ('unread', 'read', 'done');

-- ---- org (multi-tenant root) ------------------------------------
-- สำหรับตอนนี้ใช้ org เดียว แต่ออกแบบไว้รองรับหลาย org
create table if not exists orgs (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz default now()
);

-- ---- global settings per org ------------------------------------
create table if not exists org_settings (
  org_id uuid primary key references orgs(id) on delete cascade,
  rules jsonb not null default '{}'::jsonb,
  shop_rules text[] not null default '{}',
  updated_at timestamptz default now()
);

-- ---- branches ---------------------------------------------------
create table if not exists branches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  label text not null,
  lat double precision not null default 13.7466,
  lng double precision not null default 100.5347,
  radius int not null default 20,
  rules jsonb not null default '{}'::jsonb,
  shop_rules text[] not null default '{}',
  created_at timestamptz default now()
);

-- ---- employees --------------------------------------------------
create table if not exists employees (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  branch_id uuid references branches(id) on delete set null,

  -- general info (employee-editable)
  name text not null,
  nickname text,
  phone text,
  id_number text,
  bank_name text,
  bank_account text,
  em_name text,
  em_rel text,
  em_phone text,
  photo_url text,
  bank_qr_url text,
  id_card_url text,
  color text default '#0E7C66',

  -- profile
  position text,
  department text,
  start_date date,

  -- financial/time (admin-only)
  pay_type pay_type_enum not null default 'daily',
  rate numeric not null default 480,
  commission jsonb not null default '{"type":"none","value":0}'::jsonb,
  closing_tasks text[] not null default '{}',
  day_off int[] not null default '{}',
  rule_overrides jsonb not null default '{}'::jsonb,
  notes text,

  -- auth (hashed PIN — use pgcrypto in production)
  pin_hash text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---- attendance -------------------------------------------------
create table if not exists attendance (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  date date not null,
  clock_in text,
  clock_out text,
  status attendance_status_enum not null default 'present',
  ot_min int not null default 0,
  leave_type text,
  paid boolean not null default true,
  checkin_selfie_url text,
  checkin_dist int,
  checkin_lat double precision,
  checkin_lng double precision,
  closing_done text[],
  unique (emp_id, date)
);

-- ---- sales ------------------------------------------------------
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  date date not null,
  amount numeric not null default 0,
  units int not null default 0,
  note text,
  created_at timestamptz default now()
);

-- ---- adjustments (bonuses & deductions) -------------------------
create table if not exists adjustments (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  date date not null,
  type adj_type_enum not null,
  amount numeric not null,
  note text not null default '',
  auto boolean not null default false,
  created_at timestamptz default now()
);

-- ---- leaves -----------------------------------------------------
create table if not exists leaves (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  type text not null,
  date_from date not null,
  date_to date not null,
  reason text,
  status leave_status_enum not null default 'pending',
  urgent boolean not null default false,
  created_at timestamptz default now()
);

-- ---- messages ---------------------------------------------------
create table if not exists messages (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references orgs(id) on delete cascade,
  emp_id uuid not null references employees(id) on delete cascade,
  "from" msg_from_enum not null,
  kind msg_kind_enum not null default 'message',
  text text not null,
  due date,
  status msg_status_enum not null default 'unread',
  read_at timestamptz,
  created_at timestamptz default now()
);

-- ---- notification prefs -----------------------------------------
create table if not exists prefs (
  emp_id uuid primary key references employees(id) on delete cascade,
  sound boolean not null default true,
  vibrate boolean not null default true,
  tone text not null default 'default',
  updated_at timestamptz default now()
);

-- ---- admin roles ------------------------------------------------
-- เก็บว่า auth user ไหนเป็น admin ของ org ไหน
create table if not exists admin_roles (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references orgs(id) on delete cascade,
  unique (auth_user_id, org_id)
);

-- ════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════════════════════

-- helper function: เช็คว่า current user เป็น admin ของ org นั้นไหม
create or replace function is_admin(p_org_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from admin_roles
    where auth_user_id = auth.uid()
    and org_id = p_org_id
  );
$$;

-- helper function: ดึง employee id ของ current auth user
create or replace function my_emp_id()
returns uuid language sql security definer as $$
  select id from employees
  where auth_user_id = auth.uid()
  limit 1;
$$;

-- helper function: รายชื่อพนักงานสำหรับหน้า PIN login
-- คืนเฉพาะข้อมูลที่จำเป็น ไม่เปิดเผยข้อมูลส่วนตัว/เงินเดือน
create or replace function employee_login_options()
returns table (
  id uuid,
  name text,
  nickname text,
  color text,
  photo_url text,
  login_email text
) language sql security definer set search_path = public, auth as $$
  select e.id, e.name, e.nickname, e.color, e.photo_url, u.email as login_email
  from employees e
  join auth.users u on u.id = e.auth_user_id
  where e.auth_user_id is not null
  order by e.name;
$$;

grant execute on function employee_login_options() to anon, authenticated;

-- helper function: ให้แอดมินรีเซ็ต PIN พนักงาน
create or replace function reset_employee_pin(p_emp_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_org_id uuid;
  v_auth_user_id uuid;
begin
  if p_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be exactly 4 digits';
  end if;

  select e.org_id, e.auth_user_id
    into v_org_id, v_auth_user_id
  from employees e
  where e.id = p_emp_id;

  if v_org_id is null then
    raise exception 'Employee not found';
  end if;

  if not is_admin(v_org_id) then
    raise exception 'Not allowed';
  end if;

  if v_auth_user_id is null then
    raise exception 'Employee has no auth account';
  end if;

  update auth.users
  set
    encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')),
    email_confirmed_at = coalesce(email_confirmed_at, now()),
    updated_at = now()
  where id = v_auth_user_id;
end;
$$;

grant execute on function reset_employee_pin(uuid, text) to authenticated;

-- ---- enable RLS on all tables -----------------------------------
alter table orgs enable row level security;
alter table org_settings enable row level security;
alter table branches enable row level security;
alter table employees enable row level security;
alter table attendance enable row level security;
alter table sales enable row level security;
alter table adjustments enable row level security;
alter table leaves enable row level security;
alter table messages enable row level security;
alter table prefs enable row level security;
alter table admin_roles enable row level security;

-- ---- orgs -------------------------------------------------------
create policy "admin read own org" on orgs for select
  using (is_admin(id));

-- ---- org_settings -----------------------------------------------
create policy "admin read org_settings" on org_settings for select
  using (is_admin(org_id));
create policy "admin write org_settings" on org_settings for all
  using (is_admin(org_id));

-- ---- branches ---------------------------------------------------
create policy "all read branches" on branches for select
  using (
    is_admin(org_id) or
    exists (select 1 from employees where auth_user_id = auth.uid() and org_id = branches.org_id)
  );
create policy "admin write branches" on branches for all
  using (is_admin(org_id));

-- ---- employees --------------------------------------------------
-- admin: full access within org
create policy "admin full employees" on employees for all
  using (is_admin(org_id));

-- employee: read own row
create policy "emp read self" on employees for select
  using (auth_user_id = auth.uid());

-- employee: update own general info only (enforce column-level via check)
create policy "emp update self general" on employees for update
  using (auth_user_id = auth.uid())
  with check (
    auth_user_id = auth.uid()
    -- financial fields must not change (enforced server-side too)
  );

-- ---- attendance -------------------------------------------------
create policy "admin full attendance" on attendance for all
  using (is_admin(org_id));

create policy "emp read own attendance" on attendance for select
  using (emp_id = my_emp_id());

create policy "emp insert own attendance" on attendance for insert
  with check (emp_id = my_emp_id());

create policy "emp update own attendance" on attendance for update
  using (emp_id = my_emp_id())
  with check (emp_id = my_emp_id());

-- ---- sales ------------------------------------------------------
create policy "admin full sales" on sales for all
  using (is_admin(org_id));

create policy "emp read own sales" on sales for select
  using (emp_id = my_emp_id());

-- ---- adjustments ------------------------------------------------
create policy "admin full adjustments" on adjustments for all
  using (is_admin(org_id));

create policy "emp read own adjustments" on adjustments for select
  using (emp_id = my_emp_id());

-- employee สร้าง adjustment ได้เฉพาะ urgent leave auto-deduction
create policy "emp insert urgent deduction" on adjustments for insert
  with check (emp_id = my_emp_id() and auto = true);

-- ---- leaves -----------------------------------------------------
create policy "admin full leaves" on leaves for all
  using (is_admin(org_id));

create policy "emp read own leaves" on leaves for select
  using (emp_id = my_emp_id());

create policy "emp insert own leave" on leaves for insert
  with check (emp_id = my_emp_id());

-- ---- messages ---------------------------------------------------
create policy "admin full messages" on messages for all
  using (is_admin(org_id));

create policy "emp read own messages" on messages for select
  using (emp_id = my_emp_id());

create policy "emp reply" on messages for insert
  with check (emp_id = my_emp_id() and "from" = 'emp');

create policy "emp mark read" on messages for update
  using (emp_id = my_emp_id())
  with check (emp_id = my_emp_id() and "from" = 'admin');

-- ---- prefs ------------------------------------------------------
create policy "emp manage own prefs" on prefs for all
  using (emp_id = my_emp_id());

-- ---- admin_roles ------------------------------------------------
create policy "admin read own roles" on admin_roles for select
  using (auth_user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- REALTIME
-- ════════════════════════════════════════════════════════════════
-- เปิด realtime สำหรับ tables ที่ต้องการ live sync
-- ทำใน Supabase Dashboard → Database → Replication → Tables
-- เปิด: attendance, messages, leaves

-- ════════════════════════════════════════════════════════════════
-- STORAGE BUCKETS (ทำใน Dashboard → Storage)
-- ════════════════════════════════════════════════════════════════
-- สร้าง buckets:
--   avatars    (public)
--   documents  (private — bank QR, ID card)
--   selfies    (private — check-in selfies)
