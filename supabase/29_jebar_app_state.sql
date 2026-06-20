-- Create jebar_app_state table if not already created by JE-BAR-Operate setup.
-- HR reads db.menus, db.ingredients from this table via operateCatalog.js.
-- Data is written here by the JE-BAR-Operate app auto-sync.

create table if not exists public.jebar_app_state (
  shop_code text primary key,
  db jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.jebar_app_state enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'jebar_app_state' and policyname = 'jebar anon select app state'
  ) then
    create policy "jebar anon select app state" on public.jebar_app_state
    for select to anon using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'jebar_app_state' and policyname = 'jebar anon insert app state'
  ) then
    create policy "jebar anon insert app state" on public.jebar_app_state
    for insert to anon with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'jebar_app_state' and policyname = 'jebar anon update app state'
  ) then
    create policy "jebar anon update app state" on public.jebar_app_state
    for update to anon using (true) with check (true);
  end if;
end $$;
