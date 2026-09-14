-- Sales goals + order fulfillment for admin Customers/Sales/Fulfillment command center.
-- Safe for existing orders: additive columns + backfill defaults; no destructive changes.
-- Webhook continues to insert via service role (bypasses RLS).
-- Active admins gain UPDATE on orders (fulfillment) and site_settings (goals in config jsonb).

-- ---------------------------------------------------------------------------
-- ORDERS — fulfillment fields
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists fulfillment_status text not null default 'unfulfilled',
  add column if not exists fulfillment_method text not null default 'ship',
  add column if not exists tracking_number text null,
  add column if not exists carrier text null,
  add column if not exists shipped_at timestamptz null,
  add column if not exists completed_at timestamptz null;

alter table public.orders
  drop constraint if exists orders_fulfillment_status_check;

alter table public.orders
  add constraint orders_fulfillment_status_check
  check (
    fulfillment_status in (
      'unfulfilled',
      'shipped',
      'completed',
      'canceled'
    )
  );

alter table public.orders
  drop constraint if exists orders_fulfillment_method_check;

alter table public.orders
  add constraint orders_fulfillment_method_check
  check (
    fulfillment_method in (
      'ship',
      'pickup',
      'unknown'
    )
  );

comment on column public.orders.fulfillment_status is
  'Ops status: unfulfilled (needs action), shipped, completed, canceled. Independent of payment_status.';

comment on column public.orders.fulfillment_method is
  'How the customer receives the order. ship = Needs Shipping queue; pickup is excluded from that queue. unknown when method was not collected.';

comment on column public.orders.tracking_number is
  'Optional carrier tracking number set by admin when marking shipped.';

comment on column public.orders.carrier is
  'Optional carrier name (USPS, UPS, etc.) set by admin when marking shipped.';

create index if not exists orders_fulfillment_status_idx
  on public.orders (fulfillment_status);

create index if not exists orders_needs_shipping_idx
  on public.orders (created_at desc)
  where
    payment_status = 'paid'
    and fulfillment_status = 'unfulfilled'
    and fulfillment_method = 'ship';

-- Existing paid orders default to unfulfilled + ship (Checkout currently collects US shipping).
-- Refunded/canceled payments: mark fulfillment canceled so they leave the Needs Shipping queue.
update public.orders
set
  fulfillment_status = case
    when payment_status in ('refunded', 'unpaid') then 'canceled'
    else coalesce(nullif(fulfillment_status, ''), 'unfulfilled')
  end,
  fulfillment_method = coalesce(nullif(fulfillment_method, ''), 'ship')
where true;

-- ---------------------------------------------------------------------------
-- RLS — admin can update fulfillment (SELECT already exists)
-- ---------------------------------------------------------------------------

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- ---------------------------------------------------------------------------
-- SITE SETTINGS — admin update for sales goals in config jsonb
-- Keys (cents, integers):
--   config.sales_goals.weekly_cents
--   config.sales_goals.annual_cents
-- Defaults applied if missing: weekly $300, annual $10,000
-- ---------------------------------------------------------------------------

drop policy if exists "site_settings_admin_select" on public.site_settings;
create policy "site_settings_admin_select"
  on public.site_settings
  for select
  to authenticated
  using (public.is_active_admin());

drop policy if exists "site_settings_admin_update" on public.site_settings;
create policy "site_settings_admin_update"
  on public.site_settings
  for update
  to authenticated
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Seed default goals into singleton config without wiping other keys.
update public.site_settings
set config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
  'sales_goals',
  coalesce(config->'sales_goals', '{}'::jsonb) || jsonb_build_object(
    'weekly_cents',
    coalesce((config->'sales_goals'->>'weekly_cents')::int, 30000),
    'annual_cents',
    coalesce((config->'sales_goals'->>'annual_cents')::int, 1000000)
  )
);
