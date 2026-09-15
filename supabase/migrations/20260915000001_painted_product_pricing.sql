-- Optional Painted pricing and durable order-line finish selection.
-- Existing products and historical order items remain unchanged (NULL).

alter table public.products
  add column if not exists painted_price numeric(10, 2) null;

alter table public.products
  drop constraint if exists products_painted_price_positive;

alter table public.products
  add constraint products_painted_price_positive
  check (painted_price is null or painted_price > 0);

comment on column public.products.price is
  'Raw Concrete unit price in dollars. Existing sale_price applies to this finish.';

comment on column public.products.painted_price is
  'Optional Painted finish unit price in dollars. NULL keeps the product single-price.';

alter table public.order_items
  add column if not exists finish text null;

alter table public.order_items
  drop constraint if exists order_items_finish_check;

alter table public.order_items
  add constraint order_items_finish_check
  check (finish is null or finish in ('raw', 'painted'));

comment on column public.order_items.finish is
  'Trusted finish selected at checkout: raw or painted. NULL identifies legacy single-price rows.';
