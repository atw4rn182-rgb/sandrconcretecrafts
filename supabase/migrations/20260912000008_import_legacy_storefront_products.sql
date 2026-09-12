-- Step 4b: idempotent import of original hard-coded storefront products
-- source_key = 'legacy:<id>' — reruns skip existing keys and never overwrite owner edits.
-- Title-only matches without source_key are reported as AMBIGUOUS and skipped.
-- Photos keep root-relative /assets/... URLs (assets remain in the repo).
-- track_inventory = false — original data had no stock counts (inventory not tracked).

do $$
declare
  r record;
  v_product_id uuid;
  v_badge_id uuid;
  v_ambiguous boolean;
  v_slug text;
  inserted_count int := 0;
  skipped_count int := 0;
  ambiguous_count int := 0;
begin
  for r in
    select * from (values
      (
        'legacy:cow',
        'Highland Cow Head Wall Mount',
        'highland-cow-head-wall-mount',
        'A bold Highland cow head wall mount with long flowing hair and sweeping horns, finished in a smooth glossy white. A statement piece for any wall, indoors or on a covered porch.',
        10.00::numeric,
        '3-30',
        'best-seller',
        true,
        'single',
        '/assets/prod-01.png'
      ),
      (
        'legacy:raccoon',
        'Bespectacled Raccoon Planter',
        'bespectacled-raccoon-planter',
        'An adorable bespectacled raccoon planter cast in raw cement — ready for a small succulent or to paint your own way. Sold unpainted.',
        12.00,
        '22-36',
        null,
        false,
        'single',
        '/assets/prod-02.png'
      ),
      (
        'legacy:bigfoot',
        'Bigfoot Footprint Stepping Stone',
        'bigfoot-footprint-stepping-stone',
        'A rugged Bigfoot footprint stepping stone with a flag, mountains, and Sasquatch scene. Raw concrete, perfect for a garden path. Sold unpainted.',
        8.00,
        '22-23',
        null,
        false,
        'single',
        '/assets/prod-03.png'
      ),
      (
        'legacy:turtle',
        'Turtle Stepping Stone Paver',
        'turtle-stepping-stone-paver',
        'A detailed turtle stepping stone paver with a textured shell, cast in solid concrete to anchor any garden walkway. Sold unpainted.',
        15.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-04.png'
      ),
      (
        'legacy:deer-skull',
        'Deer Skull & Flag Wall Plaque',
        'deer-skull-flag-wall-plaque',
        'A deer skull and American flag wall plaque with crisp, layered detail. Cast and ready to hang or paint to match your space. Sold unpainted.',
        15.00,
        'D-29',
        null,
        false,
        'single',
        '/assets/prod-05.png'
      ),
      (
        'legacy:pirate-skull',
        'Pirate Skull & Swords Wall Hanging',
        'pirate-skull-swords-wall-hanging',
        'A pirate skull with crossed swords and bandana — a chunky wall hanging cast in cement. Sold unpainted and ready to finish.',
        20.00,
        'D-22',
        null,
        false,
        'single',
        '/assets/prod-06.png'
      ),
      (
        'legacy:snowman-tray',
        'Snowman Sectioned Tray',
        'snowman-sectioned-tray',
        'A charming snowman serving tray with sectioned wells for snacks, dips, or trinkets. Cast in cement. Sold unpainted.',
        12.00,
        'C-28',
        null,
        false,
        'single',
        '/assets/prod-07.png'
      ),
      (
        'legacy:feather-dish',
        'Feather Trinket Dish',
        'feather-trinket-dish',
        'A hand-painted feather trinket dish in turquoise, silver, and cream — the perfect catch-all for rings, keys, and small treasures.',
        15.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-08.png'
      ),
      (
        'legacy:eagle',
        'Hand-Painted Bald Eagle Figurine',
        'hand-painted-bald-eagle-figurine',
        'A majestic hand-painted bald eagle perched among pines, with a second eagle in flight. A finished, ready-to-display piece.',
        20.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-09.png'
      ),
      (
        'legacy:crystal-skull',
        'Crystal & Pearl Skull',
        'crystal-pearl-skull',
        'A serene blue skull accented with pearls and raw crystal clusters around the eyes. A hand-finished decorative piece with a soft, ethereal look.',
        15.00,
        null,
        'new',
        false,
        'single',
        '/assets/prod-10.png'
      ),
      (
        'legacy:succulent-skull',
        'Succulent Skull Planter',
        'succulent-skull-planter',
        'A hand-painted skull planter crowned with bright succulents and pebble detailing. A little cheeky, a lot of charm — ready to display.',
        18.00,
        null,
        'best-seller',
        true,
        'single',
        '/assets/prod-11.png'
      ),
      (
        'legacy:lion',
        'Lion Head Wall Mount',
        'lion-head-wall-mount',
        'A richly hand-painted lion head wall mount with a full golden mane. A warm, regal accent for any room.',
        20.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-12.png'
      ),
      (
        'legacy:rooster',
        'Rooster Garden Planter',
        'rooster-garden-planter',
        'A cheerful hand-painted rooster planter in fiery reds, oranges, and deep green. A farmhouse favorite for herbs or blooms.',
        18.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-13.png'
      ),
      (
        'legacy:headdress-skull',
        'Tribal Skull Headdress Plaque',
        'tribal-skull-headdress-plaque',
        'A striking tribal skull with a red-and-yellow feathered headdress, hand-painted in fine detail. Ready to hang.',
        18.00,
        null,
        'new',
        false,
        'single',
        '/assets/prod-14.png'
      ),
      (
        'legacy:frenchie',
        'French Bulldog Figurine',
        'french-bulldog-figurine',
        'A sweet sitting French bulldog figurine, hand-painted with personality. Available in several coat colors — inspired by our own frenchies!',
        15.00,
        null,
        null,
        false,
        'single',
        '/assets/prod-15.png'
      ),
      (
        'legacy:evil-skulls',
        'See / Hear / Speak No Evil Skull Trio',
        'see-hear-speak-no-evil-skull-trio',
        'A trio of ''see no, hear no, speak no evil'' skulls in a glossy bronze glaze with crisp white skeleton hands. Sold as a set of three.',
        15.00,
        null,
        null,
        false,
        'bundle',
        '/assets/prod-16r.png'
      ),
      (
        'legacy:mushroom-jars',
        'Mushroom Stash Jars (1-Up Set)',
        'mushroom-stash-jars-1-up-set',
        'A playful set of mushroom stash jars with lift-off caps in classic green 1-Up and red. Hand-painted — equal parts cute and functional.',
        18.00,
        null,
        'new',
        false,
        'bundle',
        '/assets/prod-17r.png'
      )
    ) as t(
      source_key,
      title,
      slug,
      description,
      price,
      item_no,
      badge_slug,
      featured,
      product_type,
      image_url
    )
  loop
    if exists (select 1 from public.products p where p.source_key = r.source_key) then
      skipped_count := skipped_count + 1;
      raise notice 'SKIP existing source_key=%', r.source_key;
      continue;
    end if;

    select exists (
      select 1
      from public.products p
      where lower(p.title) = lower(r.title)
        and (p.source_key is distinct from r.source_key)
    ) into v_ambiguous;

    if v_ambiguous then
      ambiguous_count := ambiguous_count + 1;
      raise warning 'AMBIGUOUS title match for % (source_key=%). Skipped — review manually; will not merge by title.', r.title, r.source_key;
      continue;
    end if;

    v_slug := r.slug;
    if exists (select 1 from public.products p where p.slug = v_slug) then
      v_slug := r.slug || '-legacy';
      if exists (select 1 from public.products p where p.slug = v_slug) then
        v_slug := r.slug || '-legacy-' || substr(md5(r.source_key), 1, 6);
      end if;
      raise notice 'Slug adjusted for % -> %', r.source_key, v_slug;
    end if;

    insert into public.products (
      title,
      slug,
      description,
      price,
      sale_price,
      quantity,
      status,
      product_type,
      featured,
      published_at,
      source_key,
      item_no,
      track_inventory
    )
    values (
      r.title,
      v_slug,
      r.description,
      r.price,
      null,
      0,
      'published',
      r.product_type,
      r.featured,
      timezone('utc', now()),
      r.source_key,
      r.item_no,
      false
    )
    returning id into v_product_id;

    insert into public.product_images (
      product_id,
      image_url,
      alt_text,
      sort_order,
      is_primary
    )
    values (
      v_product_id,
      r.image_url,
      r.title,
      0,
      true
    );

    if r.badge_slug is not null then
      select b.id into v_badge_id
      from public.badges b
      where b.slug = r.badge_slug
      limit 1;

      if v_badge_id is not null then
        insert into public.product_badges (product_id, badge_id)
        values (v_product_id, v_badge_id)
        on conflict do nothing;
      else
        raise warning 'Badge slug % not found for %', r.badge_slug, r.source_key;
      end if;
    end if;

    inserted_count := inserted_count + 1;
    raise notice 'INSERTED % (%)', r.source_key, v_product_id;
  end loop;

  raise notice 'Import complete: inserted=%, skipped_existing=%, ambiguous_skipped=%',
    inserted_count, skipped_count, ambiguous_count;
end $$;
