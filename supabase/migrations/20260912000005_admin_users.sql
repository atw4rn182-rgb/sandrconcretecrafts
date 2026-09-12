-- Step 2: single-owner admin authorization
-- Does not alter Step 1 catalog policies or grant product write access.

-- ---------------------------------------------------------------------------
-- Admin users (linked to auth.users)
-- ---------------------------------------------------------------------------

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'owner'
    check (role in ('owner', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.admin_users is
  'Authorized admin accounts. Only active rows may access /admin. Managed via SQL/Dashboard for now.';

create index admin_users_active_idx
  on public.admin_users (active)
  where active = true;

-- ---------------------------------------------------------------------------
-- Helper used by admin UI and future write policies (Step 3+)
-- ---------------------------------------------------------------------------

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.user_id = auth.uid()
      and au.active = true
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to authenticated;

comment on function public.is_active_admin() is
  'True when the current auth user is an active admin_users row.';

-- ---------------------------------------------------------------------------
-- RLS — do not weaken Step 1 catalog rules
-- Authenticated users may only read THEIR OWN admin_users row (to verify access).
-- No client insert / update / delete. Add owners via Dashboard SQL / service role.
-- ---------------------------------------------------------------------------

alter table public.admin_users enable row level security;

create policy "admin_users_select_own"
  on public.admin_users
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Explicitly no insert/update/delete policies for anon or authenticated.
