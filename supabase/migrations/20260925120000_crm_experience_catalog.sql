-- Experience and partner catalog now lives in Supabase instead of Sanity,
-- so CRM pricing, leads, and bookings no longer depend on the public CMS.
create table public.crm_experiences (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.crm_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.crm_experiences enable row level security;
alter table public.crm_partners enable row level security;

revoke all on table public.crm_experiences, public.crm_partners from anon, authenticated;
grant all on table public.crm_experiences, public.crm_partners to service_role;
