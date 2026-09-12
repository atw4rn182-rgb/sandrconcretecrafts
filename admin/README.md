# Admin area (Step 2)

Private owner login + dashboard shell for S & R Concrete Crafts.

## Pages

- `/admin/login.html` — email/password sign in
- `/admin/index.html` — protected dashboard shell

## Required before login works

### 1) Apply SQL migrations in Supabase (in order)

**Step 1 migrations are not verified as applied to your remote project from this workspace.**  
If you have not already run them, do that first:

1. `supabase/migrations/20260912000001_initial_schema.sql`
2. `supabase/migrations/20260912000002_row_level_security.sql`
3. `supabase/migrations/20260912000003_storage_product_images.sql`
4. `supabase/migrations/20260912000004_seed_badges_and_settings.sql`
5. **Step 2:** `supabase/migrations/20260912000005_admin_users.sql`

Supabase Dashboard → **SQL** → New query → paste each file → Run.

### 2) Browser config (anon key only)

```bash
copy js\env.example.js js\env.js
```

Edit `js/env.js` with:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY` (Project Settings → API)

Never put the **service role** key in `js/env.js`, admin JS, or HTML.

For Vercel: deploy `js/env.js` with those two public values (or inject them at build time). It is gitignored so it will not push automatically.

### 3) Create the owner Auth user

Supabase Dashboard → **Authentication** → **Users** → **Add user** → Email + password  
(or enable Email provider and create the account yourself).

Copy the user’s **UUID**.

### 4) Grant admin access

SQL Editor:

```sql
insert into public.admin_users (user_id, role, active)
values ('PASTE-USER-UUID-HERE', 'owner', true)
on conflict (user_id) do update
set role = excluded.role, active = true;
```

### 5) Test

1. Open `/admin/login.html`
2. Sign in with the owner email/password
3. You should land on the dashboard
4. Sign out
5. Open `/admin/index.html` while signed out → redirect to login
6. Sign in with a non-admin Auth user (if you create one) → denied

Do not paste passwords or secret keys into chat.
