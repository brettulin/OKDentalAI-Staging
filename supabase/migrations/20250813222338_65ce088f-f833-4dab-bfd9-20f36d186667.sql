-- 001_platform_superadmin.sql
create table if not exists platform_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  role text not null check (role in ('superadmin')),
  created_at timestamptz default now()
);

alter table platform_users enable row level security;

-- RLS: only the superadmin row owner can see their record
create policy "superadmin_self_read"
  on platform_users for select
  using (auth.uid() = user_id);

-- Helper function to check superadmin
create or replace function public.is_platform_superadmin()
returns boolean language sql stable security definer as $$
  select exists(
    select 1 from platform_users
    where user_id = auth.uid() and role = 'superadmin'
  );
$$;