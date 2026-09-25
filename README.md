# SAGOTRA Ops Dashboard

Internal CRM for SAGOTRA staff. CRM records, experiences, and partners all live in Supabase Postgres and Supabase Auth. No write path or required page load depends on Sanity; the Pricing page optionally reads Sanity read-only to flag experiences that haven't been added to the CRM catalog yet (see below).

## Data and access architecture

- Supabase stores CRM leads, lead activity, bookings, experience/partner catalog, experience pricing, and staff profiles. Staff can also add leads, experiences, and partners directly in the dashboard; CRM data does not depend on website inquiries or Sanity.
- The website sends consented form leads and identity-free WhatsApp click intents to `public.crm_leads` using the public anon key. The SQL migration grants only constrained `INSERT` access to `anon`; it grants no public read access to leads.
- The website reads package sale prices through `crm_public_experience_prices()`, a read-only RPC that returns only experience IDs, slugs, and sale prices. It does not expose price costs, markup, or margins.
- Dashboard database operations run in server-only code after the Supabase Auth user is checked against `crm_staff_profiles`. `SUPABASE_SERVICE_ROLE_KEY` must never be exposed through a `NEXT_PUBLIC_*` variable or placed in the website project.
- Owner/Admin can add experiences and manage pricing; any staff can add partners while creating a booking. Bookings and pricing snapshot the experience title/slug at the time they're created, so later catalog edits don't rewrite historical records.
- Owner/Admin can view and change cost and markup and view margin. Operations staff can view sale price only. The public website receives sale price only; database reads are projected in server code.
- The website's public sale price only appears if `crm_experiences.slug` matches the experience's Sanity slug exactly — there's no automatic sync between the two. The Pricing page reads Sanity read-only (when `NEXT_PUBLIC_SANITY_PROJECT_ID` is set) to list any Sanity experience with no matching CRM slug yet, with a one-click "Tambah ke CRM" to add it (see `getUnmatchedSanityExperiences` in `src/lib/data.ts`). This is a diagnostic aid only — the dashboard works fully without it.
- `crm_experiences` also stores `category` and `destination_slug` as denormalized copies of the same fields in Sanity, captured once when the experience is added to the CRM catalog. They're for CRM-side reporting/segmentation only; Sanity remains the source of truth for the content itself, and editing them later in Sanity does not update the CRM copy.
- Sanity is also used by the one-off `npm run migrate:inquiries` script, to copy legacy inquiries that predate this CRM out of Sanity's public dataset.

## Supabase setup

1. Create a Supabase project and open its SQL Editor.
2. Apply the migrations in `supabase/migrations/` in order: `20260925091530_crm_core.sql`, `20260925100000_public_experience_sale_price.sql` (grants the website anon role execution on the sale-price-only RPC), `20260925120000_crm_experience_catalog.sql` (creates the `crm_experiences` and `crm_partners` catalog tables), then `20260925130000_crm_experience_catalog_dimensions.sql` (adds `category`/`destination_slug` reporting columns to `crm_experiences`). If earlier migrations are already applied, apply only the ones missing.
3. Disable public sign-up in Supabase Auth. Create or invite staff accounts in **Authentication → Users**.
4. Add each staff account to `public.crm_staff_profiles`. Example for an Owner/Admin:

   ```sql
   insert into public.crm_staff_profiles (user_id, email, display_name, role)
   select id, email, 'Nama Owner', 'owner_admin'
   from auth.users
   where email = 'owner@example.com'
   on conflict (user_id) do update
   set email = excluded.email,
       display_name = excluded.display_name,
       role = excluded.role;
   ```

   Use `operations` for operations staff. An Auth account without a matching profile is denied access; only `owner_admin` and `operations` are valid roles.
5. Copy `.env.example` to `.env.local` in this dashboard project and set:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from Supabase project API settings.
   - `SUPABASE_SERVICE_ROLE_KEY` from the same project; server-only.
   The `NEXT_PUBLIC_SANITY_*` and `SANITY_PRODUCTION_DATASET` variables are optional: set them to enable the Pricing page's "missing from CRM" check, or to run `npm run migrate:inquiries` (see below). Leave them blank and the dashboard runs the same, just without that check.
   Remove any Clerk variables from this file; this dashboard no longer uses Clerk.
6. In the separate `sogatra-web` project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the same Supabase project. The website must not receive the service-role key.
7. Install and start the dashboard:

   ```sh
   npm install
   npm run dev
   ```

   Restart the server after changing `.env.local`.

## Local Playwright smoke tests

The dashboard project runs Playwright Test with local Chromium and starts both Next.js apps with Supabase credentials blank. These checks do not write to Supabase.

From this dashboard directory, with dependencies installed in both projects:

```sh
npx playwright install chromium
npm run test:e2e
```

The tests use isolated `.next-playwright/` build directories and ports `3215` and `3216`; ensure those ports are free. They check the unauthenticated CRM setup page, the website inquiry error when saving is unavailable, and cross-origin rejection for WhatsApp intent requests. They do not test live Supabase Auth, RLS, or successful database writes; use a separate staging project and test account for those checks.

## CRM behavior

- Website form inquiries and WhatsApp clicks enter the same CRM lead table as staff-created manual leads. WhatsApp records contain the source path and optional experience snapshot, not a visitor's name or phone. A click is not proof that a message was sent.
- Leads move through Baru, Dihubungi, Ditawari Harga, Dikonfirmasi, Selesai, and Batal. Status/contact changes are stored in the activity log.
- A booking can be created only from a confirmed lead; a database uniqueness constraint allows one booking per lead. Price and experience details are snapshots, so later edits do not rewrite historical bookings.
- Owner/Admin pricing is configured per experience as cost plus markup; sale price is rounded to whole rupiah and is the website's only public price source. Cost and markup remain private. Booking prices are snapshots; margin is available to Owner/Admin only after a booking exists.
- Monthly conversion counts confirmed/completed leads created in the current Jakarta month. Monthly margin sums bookings created in that month and is only shown to Owner/Admin.
- Owner/Admin adds new experiences from the Pricing page (a slug is generated from the name if left blank; category and destination slug are optional). Any staff can add a new partner inline from the Booking page. Both lists populate the dropdowns used across leads, pricing, and bookings.

## Existing public Sanity inquiries

Older inquiries may contain contact details in Sanity's public `production` dataset. They remain there until separately authorized for removal; this project does not migrate or delete them automatically. Review access and authorize any removal before treating the privacy cutover as complete.

## Copying existing inquiries

The migration tool has a dry-run default and never deletes source records:

```sh
npm run migrate:inquiries
npm run migrate:inquiries -- --apply
```

It reads inquiries from Sanity `production`, copies them to Supabase, and uses `legacy_source_id` to avoid duplicate copies. Run the dry run first with authorized Sanity read access and a Supabase service-role key. Use `--apply` only after reviewing the count and approving the copy; separately verify records before any separately authorized deletion of the public originals.
