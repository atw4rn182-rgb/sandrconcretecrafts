-- In-person cash and Stripe Terminal sales foundation.
-- Additive and intentionally unapplied: online Checkout remains unchanged.

alter table public.orders
  add column if not exists payment_source text,
  add column if not exists sold_at timestamptz,
  add column if not exists recorded_by uuid null references auth.users (id) on delete set null,
  add column if not exists sale_note text null,
  add column if not exists idempotency_key text null,
  add column if not exists receipt_email text null,
  add column if not exists receipt_sent_at timestamptz null,
  add column if not exists receipt_provider_id text null;

update public.orders
set
  payment_source = coalesce(payment_source, 'online'),
  sold_at = coalesce(sold_at, created_at)
where payment_source is null or sold_at is null;

alter table public.orders
  alter column payment_source set default 'online',
  alter column payment_source set not null,
  alter column sold_at set default timezone('utc', now()),
  alter column sold_at set not null,
  alter column stripe_session_id drop not null;

alter table public.orders
  drop constraint if exists orders_payment_source_check,
  drop constraint if exists orders_sale_note_length_check,
  drop constraint if exists orders_receipt_email_length_check;

alter table public.orders
  add constraint orders_payment_source_check
    check (payment_source in ('online', 'cash', 'tap_to_pay')),
  add constraint orders_sale_note_length_check
    check (sale_note is null or char_length(sale_note) <= 500),
  add constraint orders_receipt_email_length_check
    check (receipt_email is null or char_length(receipt_email) <= 254);

create unique index if not exists orders_idempotency_key_unique_idx
  on public.orders (idempotency_key)
  where idempotency_key is not null;

create unique index if not exists orders_stripe_payment_intent_unique_idx
  on public.orders (stripe_payment_intent)
  where stripe_payment_intent is not null;

create index if not exists orders_payment_source_sold_at_idx
  on public.orders (payment_source, sold_at desc);

comment on column public.orders.payment_source is
  'Payment channel: hosted Checkout (online), cash, or Stripe Terminal (tap_to_pay).';
comment on column public.orders.sold_at is
  'Authoritative sale timestamp used by revenue reporting; historical rows use created_at.';
comment on column public.orders.recorded_by is
  'Admin auth user that recorded an in-person sale. NULL for online Checkout.';
comment on column public.orders.idempotency_key is
  'Server-validated client operation key that prevents duplicate in-person orders.';
comment on column public.orders.receipt_email is
  'Optional validated receipt destination. Sending is implemented separately.';

-- Internal implementation. It remains inaccessible through PostgREST.
create or replace function public._create_in_person_sale(
  p_payment_source text,
  p_sold_at timestamptz,
  p_recorded_by uuid,
  p_sale_note text,
  p_idempotency_key text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_receipt_email text,
  p_stripe_payment_intent text,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_existing public.orders;
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_kind text;
  v_finish text;
  v_name text;
  v_product_id uuid;
  v_quantity integer;
  v_unit_cents integer;
  v_line_total bigint;
  v_total bigint := 0;
begin
  if p_payment_source not in ('cash', 'tap_to_pay') then
    raise exception using errcode = '22023', message = 'Invalid in-person payment source.';
  end if;
  if p_recorded_by is null or not exists (
    select 1 from public.admin_users
    where user_id = p_recorded_by and active = true
  ) then
    raise exception using errcode = '42501', message = 'An active admin is required.';
  end if;
  if p_sold_at is null
     or p_sold_at < timezone('utc', now()) - interval '366 days'
     or p_sold_at > timezone('utc', now()) + interval '5 minutes' then
    raise exception using errcode = '22023', message = 'Sale timestamp is outside the allowed range.';
  end if;
  if p_idempotency_key is null
     or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$' then
    raise exception using errcode = '22023', message = 'Invalid idempotency key.';
  end if;
  if p_sale_note is not null and char_length(p_sale_note) > 500 then
    raise exception using errcode = '22023', message = 'Sale note is too long.';
  end if;
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 100 then
    raise exception using errcode = '22023', message = 'A sale requires 1 to 100 line items.';
  end if;

  select * into v_existing
  from public.orders
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payment_source <> p_payment_source
       or v_existing.recorded_by is distinct from p_recorded_by then
      raise exception using errcode = '23505', message = 'Idempotency key is already in use.';
    end if;
    return v_existing;
  end if;

  -- Resolve every amount from catalog data or a tightly bounded admin custom line.
  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'Invalid line item.';
    end if;
    v_kind := coalesce(v_item->>'type', 'product');
    begin
      v_quantity := (v_item->>'quantity')::integer;
    exception when others then
      raise exception using errcode = '22023', message = 'Invalid line quantity.';
    end;
    if v_quantity < 1 or v_quantity > 99 then
      raise exception using errcode = '22023', message = 'Line quantity must be 1 through 99.';
    end if;

    if v_kind = 'product' then
      begin
        v_product_id := (v_item->>'product_id')::uuid;
      exception when others then
        raise exception using errcode = '22023', message = 'Invalid product id.';
      end;
      v_finish := lower(coalesce(v_item->>'finish', 'raw'));
      if v_finish not in ('raw', 'painted') then
        raise exception using errcode = '22023', message = 'Invalid product finish.';
      end if;
      select * into v_product
      from public.products
      where id = v_product_id and status in ('published', 'sold_out');
      if not found then
        raise exception using errcode = '22023', message = 'Product is unavailable for in-person sale.';
      end if;
      v_name := v_product.title;
      if v_finish = 'painted' then
        if v_product.painted_price is null or v_product.painted_price <= 0 then
          raise exception using errcode = '22023', message = 'Painted finish is unavailable.';
        end if;
        v_unit_cents := round(v_product.painted_price * 100)::integer;
      else
        v_unit_cents := round(
          case
            when v_product.sale_price is not null
                 and v_product.sale_price < v_product.price
              then v_product.sale_price
            else v_product.price
          end * 100
        )::integer;
      end if;
    elsif v_kind = 'custom' then
      v_product_id := null;
      v_finish := null;
      v_name := btrim(coalesce(v_item->>'name', ''));
      if char_length(v_name) < 1 or char_length(v_name) > 120 then
        raise exception using errcode = '22023', message = 'Custom line name must be 1 to 120 characters.';
      end if;
      if coalesce(v_item->>'unit_amount_cents', '') !~ '^[0-9]{1,7}$' then
        raise exception using errcode = '22023', message = 'Custom amount must be integer cents.';
      end if;
      v_unit_cents := (v_item->>'unit_amount_cents')::integer;
      if v_unit_cents < 1 or v_unit_cents > 1000000 then
        raise exception using errcode = '22023', message = 'Custom amount must be between 1 and 1000000 cents.';
      end if;
    else
      raise exception using errcode = '22023', message = 'Invalid line type.';
    end if;

    v_line_total := v_unit_cents::bigint * v_quantity;
    v_total := v_total + v_line_total;
    if v_line_total > 100000000 or v_total > 100000000 then
      raise exception using errcode = '22023', message = 'Sale total is too large.';
    end if;
  end loop;

  insert into public.orders (
    stripe_session_id, stripe_payment_intent, payment_status, payment_source,
    amount_total, currency, customer_name, customer_email, customer_phone,
    fulfillment_status, fulfillment_method, completed_at, sold_at, recorded_by,
    sale_note, idempotency_key, receipt_email, metadata
  ) values (
    null, nullif(p_stripe_payment_intent, ''),
    case when p_payment_source = 'cash' then 'paid' else 'unpaid' end,
    p_payment_source, v_total::integer, 'usd',
    nullif(p_customer_name, ''), nullif(p_customer_email, ''),
    nullif(p_customer_phone, ''),
    case when p_payment_source = 'cash' then 'completed' else 'unfulfilled' end,
    'pickup',
    case when p_payment_source = 'cash' then p_sold_at else null end,
    p_sold_at, p_recorded_by, nullif(p_sale_note, ''),
    p_idempotency_key, nullif(p_receipt_email, ''),
    jsonb_build_object('source', 'in_person')
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_kind := coalesce(v_item->>'type', 'product');
    v_quantity := (v_item->>'quantity')::integer;
    if v_kind = 'product' then
      v_product_id := (v_item->>'product_id')::uuid;
      v_finish := lower(coalesce(v_item->>'finish', 'raw'));
      select * into v_product from public.products where id = v_product_id;
      v_name := v_product.title;
      v_unit_cents := round(
        case
          when v_finish = 'painted' then v_product.painted_price
          when v_product.sale_price is not null and v_product.sale_price < v_product.price
            then v_product.sale_price
          else v_product.price
        end * 100
      )::integer;
    else
      v_product_id := null;
      v_finish := null;
      v_name := btrim(v_item->>'name');
      v_unit_cents := (v_item->>'unit_amount_cents')::integer;
    end if;
    insert into public.order_items (
      order_id, product_id, product_name, finish, quantity, unit_amount, amount_total
    ) values (
      v_order.id, v_product_id, v_name, v_finish, v_quantity,
      v_unit_cents, v_unit_cents * v_quantity
    );
  end loop;
  return v_order;
exception
  when unique_violation then
    select * into v_existing
    from public.orders where idempotency_key = p_idempotency_key;
    if found
       and v_existing.payment_source = p_payment_source
       and v_existing.recorded_by is not distinct from p_recorded_by then
      return v_existing;
    end if;
    raise;
end;
$$;

revoke all on function public._create_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb
) from public;

create or replace function public.record_in_person_sale(
  p_payment_source text,
  p_sold_at timestamptz,
  p_recorded_by uuid,
  p_sale_note text,
  p_idempotency_key text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_receipt_email text,
  p_stripe_payment_intent text,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  return public._create_in_person_sale(
    p_payment_source, p_sold_at, p_recorded_by, p_sale_note,
    p_idempotency_key, p_customer_name, p_customer_email, p_customer_phone,
    p_receipt_email, p_stripe_payment_intent, p_items
  );
end;
$$;

revoke all on function public.record_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb
) from public, anon, authenticated;
grant execute on function public.record_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb
) to service_role;

create or replace function public.record_cash_sales_batch(
  p_recorded_by uuid,
  p_sales jsonb
)
returns setof public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sale jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  if jsonb_typeof(p_sales) <> 'array'
     or jsonb_array_length(p_sales) < 1
     or jsonb_array_length(p_sales) > 25 then
    raise exception using errcode = '22023', message = 'A batch requires 1 to 25 sales.';
  end if;
  for v_sale in select value from jsonb_array_elements(p_sales)
  loop
    return next public._create_in_person_sale(
      'cash',
      (v_sale->>'sold_at')::timestamptz,
      p_recorded_by,
      nullif(v_sale->>'sale_note', ''),
      v_sale->>'idempotency_key',
      nullif(v_sale->>'customer_name', ''),
      nullif(v_sale->>'customer_email', ''),
      nullif(v_sale->>'customer_phone', ''),
      nullif(v_sale->>'receipt_email', ''),
      null,
      v_sale->'items'
    );
  end loop;
end;
$$;

revoke all on function public.record_cash_sales_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_cash_sales_batch(uuid, jsonb)
  to service_role;

create or replace function public.attach_terminal_payment_intent(
  p_order_id uuid,
  p_recorded_by uuid,
  p_payment_intent text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  if p_payment_intent !~ '^pi_[A-Za-z0-9_]+$' then
    raise exception using errcode = '22023', message = 'Invalid PaymentIntent id.';
  end if;
  update public.orders
  set stripe_payment_intent = p_payment_intent
  where id = p_order_id
    and payment_source = 'tap_to_pay'
    and recorded_by = p_recorded_by
    and (stripe_payment_intent is null or stripe_payment_intent = p_payment_intent)
    and (payment_status = 'unpaid' or stripe_payment_intent = p_payment_intent)
  returning * into v_order;
  if not found then
    raise exception using errcode = 'P0002', message = 'Terminal order was not found.';
  end if;
  return v_order;
end;
$$;

revoke all on function public.attach_terminal_payment_intent(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.attach_terminal_payment_intent(uuid, uuid, text)
  to service_role;

create or replace function public.confirm_tap_to_pay_payment(
  p_payment_intent text,
  p_amount integer,
  p_currency text
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'Service role required.';
  end if;
  select * into v_order
  from public.orders
  where stripe_payment_intent = p_payment_intent
    and payment_source = 'tap_to_pay';
  if not found then
    return null;
  end if;
  if v_order.amount_total <> p_amount
     or lower(v_order.currency) <> lower(p_currency) then
    raise exception using errcode = '22023', message = 'Terminal payment amount does not match the order.';
  end if;
  if v_order.payment_status = 'paid' then
    return v_order;
  end if;
  update public.orders
  set
    payment_status = 'paid',
    fulfillment_status = 'completed',
    completed_at = coalesce(completed_at, sold_at)
  where id = v_order.id and payment_status = 'unpaid'
  returning * into v_order;
  return v_order;
end;
$$;

revoke all on function public.confirm_tap_to_pay_payment(text, integer, text)
  from public, anon, authenticated;
grant execute on function public.confirm_tap_to_pay_payment(text, integer, text)
  to service_role;

-- Existing SELECT/UPDATE policies remain. There are deliberately no browser
-- INSERT policies on orders or order_items; all writes above require service_role.
