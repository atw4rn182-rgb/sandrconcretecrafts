-- Standardize public business name to S&R Concrete Crafts
-- Updates saved site_settings rows and column defaults.
-- Source HTML alone does not change already-seeded database values.

alter table public.site_settings
  alter column site_name set default 'S&R Concrete Crafts',
  alter column business_name set default 'S&R Concrete Crafts';

update public.site_settings
set
  site_name = 'S&R Concrete Crafts',
  business_name = 'S&R Concrete Crafts',
  updated_at = now()
where
  site_name is distinct from 'S&R Concrete Crafts'
  or business_name is distinct from 'S&R Concrete Crafts';
