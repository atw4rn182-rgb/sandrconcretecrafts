-- Orders + line items for Stripe Checkout (webhook upserts via service role)
-- Admin (active) can SELECT only. No public/anon access. No browser writes.

-- ---------------------------------------------------------------------------
-- ORDERS
-- ---------------------------------------------------------------------------

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null,
  stripe_payment_intent text null,
  payment_status text not null default 'unpaid',
  amount_total integer not null default 0 check (amount_total >= 0),
  currency text not null default 'usd',
  customer_name text null,
  customer_email text null,
  customer_phone text null,
  shipping_name text null,
  shipping_line1 text null,
  shipping_line2 text null,
  shipping_city text null,
  shipping_state text null,
  shipping_postal_code text null,
  shipping_country text null,
  shipping_address jsonb null,
  metadata jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint orders_stripe_session_id_unique unique (stripe_session_id)
);

create index orders_created_at_idx on public.orders (created_at desc);
create index orders_customer_email_idx on public.orders (customer_email);
create index orders_payment_status_idx on public.orders (payment_status);

create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function public.set_updated_at();

comment on table public.orders is
  'Customer orders from Stripe Checkout. Inserted/updated only by server webhook (service role).';

-- ---------------------------------------------------------------------------
-- ORDER ITEMS
-- ---------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid null references public.products (id) on delete set null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_amount integer null check (unit_amount is null or unit_amount >= 0),
  amount_total integer not null check (amount_total >= 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index order_items_order_id_idx on public.order_items (order_id);
create index order_items_product_id_idx on public.order_items (product_id);

comment on table public.order_items is
  'Line items for an order. amount_total / unit_amount are integer cents.';

-- ---------------------------------------------------------------------------
-- RLS — admin read only; service role bypasses for webhook writes
-- ---------------------------------------------------------------------------

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "orders_admin_select"
  on public.orders
  for select
  to authenticated
  using (public.is_active_admin());

create policy "order_items_admin_select"
  on public.order_items
  for select
  to authenticated
  using (public.is_active_admin());

-- Intentionally no insert/update/delete policies for anon or authenticated.
-- Webhook uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).
