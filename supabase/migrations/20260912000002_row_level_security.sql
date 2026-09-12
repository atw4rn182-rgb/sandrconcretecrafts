-- Row Level Security for catalog + settings
-- Public (anon): read published / active storefront data only
-- Writes: blocked for anon and authenticated until admin policies (Step 2)
-- Service role: bypasses RLS (server / dashboard only — never ship to browser)

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.categories enable row level security;
alter table public.product_categories enable row level security;
alter table public.badges enable row level security;
alter table public.product_badges enable row level security;
alter table public.site_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Helper: published product visibility
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
      and pr.status = 'published'
  );
$$;

revoke all on function public.is_published_product(uuid) from public;
grant execute on function public.is_published_product(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- PRODUCTS — public read of published only
-- ---------------------------------------------------------------------------

create policy "products_public_select_published"
  on public.products
  for select
  to anon, authenticated
  using (status = 'published');

-- No insert / update / delete policies for anon or authenticated (Step 1)

-- ---------------------------------------------------------------------------
-- PRODUCT IMAGES — public read only for images belonging to published products
-- ---------------------------------------------------------------------------

create policy "product_images_public_select_published"
  on public.product_images
  for select
  to anon, authenticated
  using (public.is_published_product(product_id));

-- ---------------------------------------------------------------------------
-- CATEGORIES — public read of active categories
-- ---------------------------------------------------------------------------

create policy "categories_public_select_active"
  on public.categories
  for select
  to anon, authenticated
  using (active = true);

-- ---------------------------------------------------------------------------
-- PRODUCT CATEGORIES — public read when product is published and category active
-- ---------------------------------------------------------------------------

create policy "product_categories_public_select"
  on public.product_categories
  for select
  to anon, authenticated
  using (
    public.is_published_product(product_id)
    and exists (
      select 1
      from public.categories c
      where c.id = category_id
        and c.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- BADGES — public read of active badge definitions
-- ---------------------------------------------------------------------------

create policy "badges_public_select_active"
  on public.badges
  for select
  to anon, authenticated
  using (active = true);

-- ---------------------------------------------------------------------------
-- PRODUCT BADGES — public read when product is published and badge active
-- ---------------------------------------------------------------------------

create policy "product_badges_public_select"
  on public.product_badges
  for select
  to anon, authenticated
  using (
    public.is_published_product(product_id)
    and exists (
      select 1
      from public.badges b
      where b.id = badge_id
        and b.active = true
    )
  );

-- ---------------------------------------------------------------------------
-- SITE SETTINGS — public read (needed later for theme / branding)
-- Writes remain closed until admin auth (Step 2)
-- ---------------------------------------------------------------------------

create policy "site_settings_public_select"
  on public.site_settings
  for select
  to anon, authenticated
  using (true);
