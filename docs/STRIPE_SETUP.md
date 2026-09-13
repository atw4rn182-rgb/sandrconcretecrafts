# Stripe Checkout (server-only secrets)

This site is mostly static HTML. Stripe secrets must **never** enter `js/env.js` or the browser.

## Approach

- Hosted **Stripe Checkout** (payment mode) via `POST /api/create-checkout-session`
- Webhook verification via `POST /api/stripe-webhook`
- On `checkout.session.completed`, the webhook **upserts** `orders` + `order_items` (service role)
- Public feature flag `USE_STRIPE_CHECKOUT` (default `false`) keeps **demo checkout** until you flip it

Prices always come from Supabase on the server. The client may send product id + quantity only.

## Required SQL (run in Supabase before expecting orders)

Apply new migration (do not edit old ones):

`supabase/migrations/20260913000001_orders.sql`

Supabase Dashboard → **SQL** → paste → Run.

## Vercel environment variables

### Already used by the shop (public / build)

| Name | Secret? | Environments | Notes |
|------|---------|--------------|--------|
| `SUPABASE_URL` | Public | Production (+ Preview if needed) | Shop + Checkout product lookup |
| `SUPABASE_ANON_KEY` | Public | Production (+ Preview if needed) | Anon key + RLS only |
| `USE_LIVE_CATALOG` | Public flag | Production | Must be `true` for real catalog IDs at checkout |
| `USE_STRIPE_CHECKOUT` | Public flag | Production | Set `true` only after test Checkout works |

### Stripe + order writes — Production, server-only

| Name | Secret? | Environments | Where to get it |
|------|---------|--------------|-----------------|
| `STRIPE_SECRET_KEY` | **SECRET** | **Production only** (server) | Stripe → API keys → Secret (`sk_test_…` first) |
| `STRIPE_WEBHOOK_SECRET` | **SECRET** | **Production only** (server) | Stripe → Webhooks → Signing secret (`whsec_…`) |
| `SITE_URL` | Public config | Production (server) | `https://www.sandrconcretecrafts.com` |
| `SUPABASE_SERVICE_ROLE_KEY` | **SECRET** | **Production only** (serverless) | Supabase → Settings → API → `service_role` |
| `STRIPE_PUBLISHABLE_KEY` | Public | Optional / later | Not required for hosted Checkout redirect |
| `STRIPE_ALLOW_LIVE` | Safety flag | Production | Leave `false` / unset — do **not** enable live charges yet |

**Do not** add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, or any `sk_` / `rk_` / `whsec_` value to:

- `js/env.js`
- `scripts/write-public-env.js` output
- client HTML/JS

`SUPABASE_SERVICE_ROLE_KEY` is allowed on Vercel **only** for Serverless Functions (webhook). It must never be listed in the public build script.

## Webhook endpoint

- URL: `https://www.sandrconcretecrafts.com/api/stripe-webhook`
- Events to enable:
  - `checkout.session.completed` (required — upserts order + line items)
  - `checkout.session.async_payment_succeeded` / `async_payment_failed` (optional)
  - `charge.refunded` (optional — sets `refunded` / `partially_refunded`)
- Behavior: verify signature → load session + line items → upsert by `stripe_session_id` using **service role on the server only**
- Admin reads orders with the owner’s existing Supabase session (`is_active_admin()` RLS). Never uses the service role in the browser.

## Admin

- `/admin/orders.html` — newest first; tap a card for customer, shipping, items, payment status, Stripe ids
- RLS: active admins can **read** orders; only service role writes

## Exact Vercel variable names

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
SITE_URL
SUPABASE_SERVICE_ROLE_KEY
USE_STRIPE_CHECKOUT
STRIPE_ALLOW_LIVE
```

(Plus existing public shop vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `USE_LIVE_CATALOG`.)

Webhook URL:

```
https://www.sandrconcretecrafts.com/api/stripe-webhook
```

## Deploy checklist (test mode only)

1. **Supabase SQL** — run `supabase/migrations/20260913000001_orders.sql` if not already applied.
2. **Commit & push** the Stripe/orders code to `main` (no `.env`, no real keys).
3. **Vercel → Production env** (test keys first):
   - `STRIPE_SECRET_KEY` = `sk_test_…`
   - `STRIPE_WEBHOOK_SECRET` = `whsec_…`
   - `SITE_URL` = `https://www.sandrconcretecrafts.com`
   - `SUPABASE_SERVICE_ROLE_KEY` = service role (server only)
   - `USE_STRIPE_CHECKOUT` = `true` (after redeploy with secrets in place)
   - `STRIPE_ALLOW_LIVE` = leave unset or `false`
4. **Redeploy** Vercel Production.
5. **Stripe Dashboard → Webhooks** (test mode) → endpoint  
   `https://www.sandrconcretecrafts.com/api/stripe-webhook`  
   Enable:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
6. **One test purchase:** shop → add product → Checkout → pay with card `4242 4242 4242 4242`, any future expiry, any CVC.
7. **Where to see the order:** Admin → **Orders** (`/admin/orders.html`) — newest first; tap the row for full customer, shipping, items, and Paid status.

Do **not** set `STRIPE_ALLOW_LIVE=true` and do **not** paste `sk_live_` / `rk_live_` keys until you explicitly choose to go live.