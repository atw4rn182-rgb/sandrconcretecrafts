-- Seed reusable badge definitions + default site settings
-- Badges are manually assignable; no automated sales metrics.

insert into public.badges (name, slug, label, active, sort_order)
values
  ('New', 'new', 'New', true, 10),
  ('Featured', 'featured', 'Featured', true, 20),
  ('Best Seller', 'best-seller', 'Best Seller', true, 30),
  ('Hot Seller', 'hot-seller', 'Hot Seller', true, 40),
  ('Limited', 'limited', 'Limited', true, 50),
  ('Low Stock', 'low-stock', 'Low Stock', true, 60),
  ('Sale', 'sale', 'Sale', true, 70),
  ('Handmade', 'handmade', 'Handmade', true, 80),
  ('One of a Kind', 'one-of-a-kind', 'One of a Kind', true, 90)
on conflict (slug) do update
set
  name = excluded.name,
  label = excluded.label,
  active = excluded.active,
  sort_order = excluded.sort_order;

insert into public.site_settings (
  site_name,
  business_name,
  default_theme,
  seasonal_themes_enabled,
  active_theme_override,
  config
)
select
  'S&R Concrete Crafts',
  'S&R Concrete Crafts',
  'southwestern',
  false,
  null,
  jsonb_build_object(
    'domain', 'sandrconcretecrafts.com',
    'tagline', 'Hand-cast concrete art for home and yard',
    'contact_email', null,
    'social', jsonb_build_object(
      'instagram', null,
      'pinterest', null,
      'etsy', null
    ),
    'features', jsonb_build_object(
      'stripe_enabled', false,
      'admin_enabled', false
    )
  )
where not exists (select 1 from public.site_settings);
