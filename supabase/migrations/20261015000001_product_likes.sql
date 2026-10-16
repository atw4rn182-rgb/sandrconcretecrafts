-- Storefront hearts: one public like count per product.
-- Shoppers never write the count. toggle_product_like() is the only writer:
-- it records one row per (product, device) and moves the count by exactly one.

alter table public.products
  add column if not exists like_count integer not null default 0;

alter table public.products
  drop constraint if exists products_like_count_nonnegative;

alter table public.products
  add constraint products_like_count_nonnegative check (like_count >= 0);

comment on column public.products.like_count is
  'Public storefront heart count. Changed only by toggle_product_like().';

-- Popular view: only liked products, highest first.
create index if not exists products_popular_idx
  on public.products (like_count desc, id)
  where like_count > 0;

create table if not exists public.product_likes (
  product_id uuid not null references public.products (id) on delete cascade,
  device_id uuid not null,
  ip_hash text null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (product_id, device_id)
);

create index if not exists product_likes_device_recent_idx
  on public.product_likes (device_id, created_at desc);

create index if not exists product_likes_ip_recent_idx
  on public.product_likes (ip_hash, created_at desc)
  where ip_hash is not null;

-- No policies: the browser cannot read or write this table directly.
alter table public.product_likes enable row level security;
revoke all on public.product_likes from anon, authenticated;

comment on table public.product_likes is
  'One row per hearted product per shopper device. Private; written only by toggle_product_like().';

-- Keep like_count out of reach of ordinary product saves, and keep a like
-- from bumping updated_at (Admin sorts by it). Named to run after
-- products_set_updated_at, because BEFORE triggers fire in name order.
create or replace function public.guard_product_like_count()
returns trigger
language plpgsql
as $$
declare
  like_write boolean := coalesce(current_setting('sr.like_write', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if not like_write then
      new.like_count := 0;
    end if;
    return new;
  end if;
  if like_write then
    new.updated_at := old.updated_at;
  elsif new.like_count is distinct from old.like_count then
    new.like_count := old.like_count;
  end if;
  return new;
end;
$$;

drop trigger if exists products_zz_like_count_guard on public.products;
create trigger products_zz_like_count_guard
  before insert or update on public.products
  for each row
  execute function public.guard_product_like_count();

create or replace function public.toggle_product_like(
  p_product_id uuid,
  p_device_id uuid,
  p_like boolean
)
returns table (product_id uuid, like_count integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer := 0;
  forwarded text;
  client_ip_hash text;
begin
  if p_product_id is null or p_device_id is null or p_like is null then
    raise exception 'Invalid like request.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.products pr
    where pr.id = p_product_id and pr.status in ('published', 'sold_out')
  ) then
    raise exception 'Product not found.' using errcode = 'P0002';
  end if;

  if p_like then
    begin
      forwarded := nullif(split_part(
        coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
        ',', 1), '');
    exception when others then
      forwarded := null;
    end;
    if forwarded is not null then
      client_ip_hash := md5('sr-like:' || trim(forwarded));
    end if;

    if (
      select count(*) from public.product_likes l
      where l.device_id = p_device_id
        and l.created_at > timezone('utc', now()) - interval '1 hour'
    ) >= 120 then
      raise exception 'Too many hearts right now. Please try again later.' using errcode = 'P0001';
    end if;

    if client_ip_hash is not null and (
      select count(*) from public.product_likes l
      where l.ip_hash = client_ip_hash
        and l.created_at > timezone('utc', now()) - interval '1 hour'
    ) >= 400 then
      raise exception 'Too many hearts right now. Please try again later.' using errcode = 'P0001';
    end if;

    insert into public.product_likes (product_id, device_id, ip_hash)
    values (p_product_id, p_device_id, client_ip_hash)
    on conflict do nothing;
    get diagnostics changed = row_count;
  else
    delete from public.product_likes l
    where l.product_id = p_product_id and l.device_id = p_device_id;
    get diagnostics changed = row_count;
  end if;

  if changed > 0 then
    perform set_config('sr.like_write', 'on', true);
    update public.products pr
    set like_count = greatest(0, pr.like_count + case when p_like then 1 else -1 end)
    where pr.id = p_product_id;
    perform set_config('sr.like_write', 'off', true);
  end if;

  return query
  select pr.id, pr.like_count, p_like
  from public.products pr
  where pr.id = p_product_id;
end;
$$;

revoke all on function public.toggle_product_like(uuid, uuid, boolean) from public;
grant execute on function public.toggle_product_like(uuid, uuid, boolean) to anon, authenticated;

comment on function public.toggle_product_like(uuid, uuid, boolean) is
  'Heart or un-heart a public product for one device. Idempotent; returns the authoritative count.';

notify pgrst, 'reload schema';
