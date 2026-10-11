-- Optional custom product weight. Null means "use the base weight in settings."
-- This does not write 1 lb onto existing products.

alter table public.products
  add column if not exists weight_oz integer null;

alter table public.products
  drop constraint if exists products_weight_oz_range;

alter table public.products
  add constraint products_weight_oz_range
  check (weight_oz is null or (weight_oz >= 1 and weight_oz <= 8000));

comment on column public.products.weight_oz is
  'Custom packed weight in ounces. Null uses the configured base weight and is not a stored 1 lb.';

-- Bulk apply writes the chosen base onto products.
-- The updated_at trigger is paused so the catalog sort order stays put.
create or replace function public.apply_product_base_weight(
  p_ounces integer,
  p_missing_only boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if not public.is_active_admin() then
    raise exception 'Not allowed';
  end if;
  if p_ounces is null or p_ounces < 1 or p_ounces > 8000 then
    raise exception 'Enter a base weight from 1 ounce through 500 pounds.';
  end if;

  alter table public.products disable trigger products_set_updated_at;
  begin
    update public.products
    set weight_oz = p_ounces
    where (p_missing_only is true and weight_oz is null)
       or p_missing_only is not true;
    get diagnostics updated_count = row_count;
    alter table public.products enable trigger products_set_updated_at;
  exception
    when others then
      alter table public.products enable trigger products_set_updated_at;
      raise;
  end;

  return updated_count;
end;
$$;

revoke all on function public.apply_product_base_weight(integer, boolean) from public;
grant execute on function public.apply_product_base_weight(integer, boolean) to authenticated;

comment on function public.apply_product_base_weight(integer, boolean) is
  'Write the base weight onto products. Missing-only skips rows that already have a custom weight.';

notify pgrst, 'reload schema';
