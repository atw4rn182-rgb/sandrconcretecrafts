-- S & R Concrete Crafts — initial catalog schema
-- Step 1 foundation: products, images, categories, badges, site settings

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Products
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null,
  description text not null default '',
  price numeric(10, 2) not null check (price >= 0),
  sale_price numeric(10, 2) null check (sale_price is null or sale_price >= 0),
  quantity integer not null default 0 check (quantity >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'sold_out', 'hidden')),
  product_type text not null default 'single'
    check (product_type in ('single', 'bundle')),
  featured boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  published_at timestamptz null,
  constraint products_sale_price_lte_price
    check (sale_price is null or sale_price <= price),
  constraint products_slug_unique unique (slug)
);

create index products_status_idx on public.products (status);
create index products_featured_idx on public.products (featured) where featured = true;
create index products_published_at_idx on public.products (published_at desc nulls last);

create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function public.set_updated_at();

comment on table public.products is
  'Catalog products managed by the owner via admin (Step 2+).';

-- ---------------------------------------------------------------------------
-- Product images (multiple per product; Storage URLs live in image_url)
-- ---------------------------------------------------------------------------

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  image_url text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create index product_images_product_id_idx on public.product_images (product_id);
create index product_images_sort_idx
  on public.product_images (product_id, sort_order);

-- At most one primary image per product
create unique index product_images_one_primary_idx
  on public.product_images (product_id)
  where is_primary = true;

comment on table public.product_images is
  'Product gallery images. Prefer Storage public URLs from the product-images bucket.';

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint categories_slug_unique unique (slug)
);

create index categories_active_sort_idx
  on public.categories (active, sort_order);

-- ---------------------------------------------------------------------------
-- Product ↔ category (many-to-many)
-- ---------------------------------------------------------------------------

create table public.product_categories (
  product_id uuid not null references public.products (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  primary key (product_id, category_id)
);

create index product_categories_category_id_idx
  on public.product_categories (category_id);

-- ---------------------------------------------------------------------------
-- Badges (reusable definitions; assigned manually by the owner)
-- ---------------------------------------------------------------------------

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  label text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint badges_slug_unique unique (slug)
);

create index badges_active_sort_idx on public.badges (active, sort_order);

comment on table public.badges is
  'Reusable product badges. Manual assignment only — no automated sales stats in Step 1.';

-- ---------------------------------------------------------------------------
-- Product ↔ badge (many-to-many)
-- ---------------------------------------------------------------------------

create table public.product_badges (
  product_id uuid not null references public.products (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  primary key (product_id, badge_id)
);

create index product_badges_badge_id_idx on public.product_badges (badge_id);

-- ---------------------------------------------------------------------------
-- Site settings (single logical config row for future themes / branding)
-- ---------------------------------------------------------------------------

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  site_name text not null default 'S & R Crafts Concrete Creations',
  business_name text not null default 'S & R Crafts Concrete Creations',
  -- Planned default look; theme CSS comes in a later step
  default_theme text not null default 'southwestern',
  seasonal_themes_enabled boolean not null default false,
  -- When set, overrides default_theme (e.g. halloween, christmas, easter_spring, fourth_of_july)
  active_theme_override text null,
  -- Flexible bag for contact, social links, shipping notes, feature flags, etc.
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_settings_default_theme_check
    check (default_theme in (
      'southwestern',
      'halloween',
      'christmas',
      'easter_spring',
      'fourth_of_july'
    )),
  constraint site_settings_override_theme_check
    check (
      active_theme_override is null
      or active_theme_override in (
        'southwestern',
        'halloween',
        'christmas',
        'easter_spring',
        'fourth_of_july'
      )
    )
);

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row
  execute function public.set_updated_at();

-- Enforce a single settings row for the storefront
create unique index site_settings_singleton_idx
  on public.site_settings ((true));

comment on table public.site_settings is
  'Storefront / business configuration. Themes are planned; not applied in Step 1.';
