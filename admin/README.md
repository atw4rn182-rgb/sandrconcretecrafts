# Admin area (Step 2)

Private owner login + dashboard shell for S & R Concrete Crafts.

## Pages

- `/admin/login.html` — email/password sign in
- `/admin/index.html` — protected dashboard shell (`/admin/` serves this too)

## Required before login works

### 1) Apply SQL migrations in Supabase (in order)

1. `supabase/migrations/20260912000001_initial_schema.sql`
2. `supabase/migrations/20260912000002_row_level_security.sql`
3. `supabase/migrations/20260912000003_storage_product_images.sql`
4. `supabase/migrations/20260912000004_seed_badges_and_settings.sql`
5. `supabase/migrations/20260912000005_admin_users.sql`

Supabase Dashboard → **SQL** → New query → paste each file → Run.

### 2) Public Supabase config (URL + anon key only)

**Production (Vercel)** — required for https://sandrconcretecrafts.com/admin/

1. Vercel → project **sandrconcretecrafts** → **Settings** → **Environment Variables**
2. Add for **Production**:
   - `SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
   - `SUPABASE_ANON_KEY` = your **anon/public** key
3. Do **not** add `SUPABASE_SERVICE_ROLE_KEY` for this static site
4. Redeploy (or push to `main`) so `npm run build` generates `js/env.js` at build time

**Local**

```bash
copy js\env.example.js js\env.js
```

Edit `js/env.js` with URL + anon key only, **or** set the same env vars and run `npm run build`.

`js/env.js` is gitignored and auto-generated on Vercel. Never put the **service role** key in browser files.

### 3) Create the owner Auth user

Supabase Dashboard → **Authentication** → **Users** → **Add user** → Email + password.  
Copy the user’s **UUID**.

### 4) Grant admin access

```sql
insert into public.admin_users (user_id, role, active)
values ('PASTE-USER-UUID-HERE', 'owner', true)
on conflict (user_id) do update
set role = excluded.role, active = true;
```

### 5) Test

1. `/admin/login.html` loads
2. Owner signs in → dashboard
3. Sign out
4. `/admin/` while signed out → redirect to login
5. Non-admin Auth user → denied
6. Missing config → clear “Supabase configuration is missing” (no endless “Checking your access”)

Do not paste passwords or secret keys into chat.
