-- Step 4a: catalog fields for import + storefront sold-out visibility
-- Adds stable import identity, item numbers, and inventory tracking flag.
-- Does not weaken write policies. Extends public READ to sold_out products.

-- ---------------------------------------------------------------------------
-- Product columns
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists source_key text null;

alter table public.products
  add column if not exists item_no text null;

alter table public.products
  add column if not exists track_inventory boolean not null default false;

comment on column public.products.source_key is
  'Stable external/import identity (e.g. legacy:cow). Unique when present. Import uses ON CONFLICT DO NOTHING so owner edits are never overwritten.';

comment on column public.products.item_no is
  'Optional shop item / SKU number shown on the storefront.';

comment on column public.products.track_inventory is
  'When false, quantity is not enforced for purchases (inventory not tracked). When true, UI respects quantity limits.';

create unique index if not exists products_source_key_unique_idx
  on public.products (source_key)
  where source_key is not null;

create index if not exists products_item_no_idx
  on public.products (item_no)
  where item_no is not null;

-- ---------------------------------------------------------------------------
-- Public visibility: published + sold_out (draft/hidden remain private)
-- ---------------------------------------------------------------------------

create or replace function public.is_published_product(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.products pr
    where pr.id = p_id
      and pr.status in ('published', 'sold_out')
  );
$$;

drop policy if exists "products_public_select_published" on public.products;

create policy "products_public_select_storefront"
  on public.products
  for select
  to anon, authenticated
  using (status in ('published', 'sold_out'));

comment on function public.is_published_product(uuid) is
  'True when product is visible on the public storefront (published or sold_out).';
