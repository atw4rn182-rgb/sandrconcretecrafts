-- POS discount/tax totals for in-person sales, plus service-role order delete.
-- Does not change online Stripe Checkout. Cash callers keep default 0/0 rates.

drop function if exists public.record_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb
);

drop function if exists public.record_cash_sales_batch(uuid, jsonb);

drop function if exists public._create_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb
);

create function public._create_in_person_sale(
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
  p_items jsonb,
  p_discount_milli integer default 0,
  p_tax_milli integer default 0
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
  v_subtotal bigint := 0;
  v_discount integer := 0;
  v_tax integer := 0;
  v_total integer := 0;
  v_discount_milli integer := coalesce(p_discount_milli, 0);
  v_tax_milli integer := coalesce(p_tax_milli, 0);
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
  if v_discount_milli < 0 or v_discount_milli > 100000 then
    raise exception using errcode = '22023', message = 'Discount must be 0% through 100%.';
  end if;
  if v_tax_milli < 0 or v_tax_milli > 200000 then
    raise exception using errcode = '22023', message = 'Tax rate is outside the allowed range.';
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
    v_subtotal := v_subtotal + v_line_total;
    if v_line_total > 100000000 or v_subtotal > 100000000 then
      raise exception using errcode = '22023', message = 'Sale total is too large.';
    end if;
  end loop;

  v_discount := round((v_subtotal * v_discount_milli)::numeric / 100000.0)::integer;
  if v_discount > v_subtotal then
    v_discount := v_subtotal::integer;
  end if;
  v_tax := round(((v_subtotal - v_discount) * v_tax_milli)::numeric / 100000.0)::integer;
  v_total := (v_subtotal - v_discount + v_tax)::integer;
  if v_total < 1 then
    raise exception using errcode = '22023', message = 'Sale total must be greater than $0.00.';
  end if;

  insert into public.orders (
    stripe_session_id, stripe_payment_intent, payment_status, payment_source,
    amount_total, currency, customer_name, customer_email, customer_phone,
    fulfillment_status, fulfillment_method, completed_at, sold_at, recorded_by,
    sale_note, idempotency_key, receipt_email, metadata
  ) values (
    null, nullif(p_stripe_payment_intent, ''),
    case when p_payment_source = 'cash' then 'paid' else 'unpaid' end,
    p_payment_source, v_total, 'usd',
    nullif(p_customer_name, ''), nullif(p_customer_email, ''),
    nullif(p_customer_phone, ''),
    case when p_payment_source = 'cash' then 'completed' else 'unfulfilled' end,
    'pickup',
    case when p_payment_source = 'cash' then p_sold_at else null end,
    p_sold_at, p_recorded_by, nullif(p_sale_note, ''),
    p_idempotency_key, nullif(p_receipt_email, ''),
    jsonb_build_object(
      'source', 'in_person',
      'subtotal_cents', v_subtotal,
      'discount_cents', v_discount,
      'discount_milli', v_discount_milli,
      'tax_cents', v_tax,
      'tax_milli', v_tax_milli
    )
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
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb, integer, integer
) from public;

create function public.record_in_person_sale(
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
  p_items jsonb,
  p_discount_milli integer default 0,
  p_tax_milli integer default 0
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
    p_receipt_email, p_stripe_payment_intent, p_items,
    p_discount_milli, p_tax_milli
  );
end;
$$;

revoke all on function public.record_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb, integer, integer
) from public, anon, authenticated;
grant execute on function public.record_in_person_sale(
  text, timestamptz, uuid, text, text, text, text, text, text, text, jsonb, integer, integer
) to service_role;

create or replace function public.admin_delete_order(p_order_id uuid, p_recorded_by uuid)
returns uuid
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
  if p_recorded_by is null or not exists (
    select 1 from public.admin_users
    where user_id = p_recorded_by and active = true
  ) then
    raise exception using errcode = '42501', message = 'An active admin is required.';
  end if;
  if p_order_id is null then
    raise exception using errcode = '22023', message = 'Order id is required.';
  end if;
  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'That order was not found.';
  end if;
  delete from public.orders where id = p_order_id;
  return p_order_id;
end;
$$;

revoke all on function public.admin_delete_order(uuid, uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_order(uuid, uuid) to service_role;

create function public.record_cash_sales_batch(
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
