create table public.crm_staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  role text not null default 'operations' check (role in ('owner_admin', 'operations')),
  created_at timestamptz not null default now()
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  phone text,
  experience_id text,
  experience_slug text,
  experience_title text,
  preferred_date date,
  group_size integer check (group_size is null or group_size > 0),
  language text,
  interests text,
  message text,
  consent_given boolean not null default false,
  source text not null,
  channel text not null check (channel in ('form', 'whatsapp', 'manual')),
  status text not null default 'new' check (status in ('new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled')),
  submitted_at timestamptz not null default now(),
  status_updated_at timestamptz,
  status_updated_by text,
  created_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  legacy_source_id text unique
);

create index crm_leads_submitted_at_idx on public.crm_leads (submitted_at desc);
create index crm_leads_status_idx on public.crm_leads (status);
create index crm_leads_channel_idx on public.crm_leads (channel);

create table public.crm_experience_pricing (
  experience_id text primary key,
  experience_slug text not null,
  experience_title text not null,
  base_cost_price bigint not null check (base_cost_price >= 0),
  markup_percent numeric(8, 2) not null check (markup_percent >= 0 and markup_percent <= 1000),
  sale_price bigint not null check (sale_price >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id) on delete restrict
);

create table public.crm_bookings (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.crm_leads (id) on delete restrict,
  experience_id text not null,
  experience_slug text not null,
  experience_title text not null,
  partner_id text,
  visit_date date not null,
  group_size integer not null check (group_size > 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  cost_price bigint not null check (cost_price >= 0),
  sale_price bigint not null check (sale_price >= 0),
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users (id) on delete restrict,
  updated_at timestamptz not null default now(),
  updated_by uuid not null references auth.users (id) on delete restrict
);

create index crm_bookings_created_at_idx on public.crm_bookings (created_at desc);
create index crm_bookings_visit_date_idx on public.crm_bookings (visit_date);

create table public.crm_activity_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('lead_created', 'status', 'contact_updated', 'booking_created', 'payment_status', 'pricing_updated')),
  lead_id uuid references public.crm_leads (id) on delete cascade,
  booking_id uuid references public.crm_bookings (id) on delete cascade,
  experience_id text,
  from_value text,
  to_value text,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_name text not null,
  actor_email text not null default '',
  at timestamptz not null default now(),
  check (lead_id is not null or booking_id is not null or experience_id is not null)
);

create index crm_activity_lead_at_idx on public.crm_activity_events (lead_id, at desc);
create index crm_activity_booking_at_idx on public.crm_activity_events (booking_id, at desc);

create or replace function public.crm_record_public_lead()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.channel <> 'manual' then
    insert into public.crm_activity_events (event_type, lead_id, experience_id, to_value, actor_name, actor_email, at)
    values (
      'lead_created',
      new.id,
      new.experience_id,
      new.channel,
      case when new.legacy_source_id is null then 'Website SAGOTRA' else 'Migrasi data lama' end,
      '',
      new.submitted_at
    );
  end if;
  return new;
end;
$$;

create trigger crm_lead_created_activity
  after insert on public.crm_leads
  for each row execute function public.crm_record_public_lead();

create or replace function public.crm_create_manual_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_experience_id text,
  p_experience_slug text,
  p_experience_title text,
  p_preferred_date date,
  p_group_size integer,
  p_message text,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  created_lead_id uuid;
begin
  insert into public.crm_leads (
    name, email, phone, experience_id, experience_slug, experience_title,
    preferred_date, group_size, message, consent_given, source, channel, status, created_by
  ) values (
    p_name, p_email, p_phone, p_experience_id, p_experience_slug, p_experience_title,
    p_preferred_date, p_group_size, p_message, false, 'dashboard', 'manual', 'new', p_actor_user_id
  ) returning id into created_lead_id;

  insert into public.crm_activity_events (event_type, lead_id, experience_id, to_value, actor_user_id, actor_name, actor_email)
  values ('lead_created', created_lead_id, p_experience_id, 'manual', p_actor_user_id, p_actor_name, p_actor_email);

  return created_lead_id;
end;
$$;

create or replace function public.crm_update_lead_status(
  p_lead_id uuid,
  p_status text,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  previous_status text;
begin
  if p_status not in ('new', 'contacted', 'quoted', 'confirmed', 'completed', 'cancelled') then
    raise exception 'Invalid lead status';
  end if;

  select status into previous_status from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if previous_status = p_status then return; end if;

  update public.crm_leads
    set status = p_status, status_updated_at = now(), status_updated_by = p_actor_email, updated_at = now()
    where id = p_lead_id;

  insert into public.crm_activity_events (event_type, lead_id, from_value, to_value, actor_user_id, actor_name, actor_email)
  values ('status', p_lead_id, previous_status, p_status, p_actor_user_id, p_actor_name, p_actor_email);
end;
$$;

create or replace function public.crm_update_lead_contact(
  p_lead_id uuid,
  p_name text,
  p_phone text,
  p_email text,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.crm_leads
    set name = p_name, phone = p_phone, email = p_email, updated_at = now()
    where id = p_lead_id;
  if not found then raise exception 'Lead not found'; end if;

  insert into public.crm_activity_events (event_type, lead_id, to_value, actor_user_id, actor_name, actor_email)
  values ('contact_updated', p_lead_id, 'contact details', p_actor_user_id, p_actor_name, p_actor_email);
end;
$$;

create or replace function public.crm_save_experience_pricing(
  p_experience_id text,
  p_experience_slug text,
  p_experience_title text,
  p_base_cost_price bigint,
  p_markup_percent numeric,
  p_sale_price bigint,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.crm_experience_pricing (
    experience_id, experience_slug, experience_title, base_cost_price, markup_percent, sale_price, updated_by
  ) values (
    p_experience_id, p_experience_slug, p_experience_title, p_base_cost_price, p_markup_percent, p_sale_price, p_actor_user_id
  )
  on conflict (experience_id) do update set
    experience_slug = excluded.experience_slug,
    experience_title = excluded.experience_title,
    base_cost_price = excluded.base_cost_price,
    markup_percent = excluded.markup_percent,
    sale_price = excluded.sale_price,
    updated_at = now(),
    updated_by = excluded.updated_by;

  insert into public.crm_activity_events (event_type, experience_id, to_value, actor_user_id, actor_name, actor_email)
  values ('pricing_updated', p_experience_id, 'experience pricing', p_actor_user_id, p_actor_name, p_actor_email);
end;
$$;

create or replace function public.crm_create_booking(
  p_lead_id uuid,
  p_experience_id text,
  p_experience_slug text,
  p_experience_title text,
  p_partner_id text,
  p_visit_date date,
  p_group_size integer,
  p_payment_status text,
  p_cost_price bigint,
  p_sale_price bigint,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_status text;
  created_booking_id uuid;
begin
  if p_payment_status not in ('unpaid', 'paid') then raise exception 'Invalid payment status'; end if;
  select status into current_status from public.crm_leads where id = p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if current_status <> 'confirmed' then raise exception 'Booking requires a confirmed lead'; end if;

  insert into public.crm_bookings (
    lead_id, experience_id, experience_slug, experience_title, partner_id, visit_date, group_size,
    payment_status, cost_price, sale_price, created_by, updated_by
  ) values (
    p_lead_id, p_experience_id, p_experience_slug, p_experience_title, p_partner_id, p_visit_date, p_group_size,
    p_payment_status, p_cost_price, p_sale_price, p_actor_user_id, p_actor_user_id
  ) returning id into created_booking_id;

  insert into public.crm_activity_events (
    event_type, lead_id, booking_id, experience_id, to_value, actor_user_id, actor_name, actor_email
  ) values (
    'booking_created', p_lead_id, created_booking_id, p_experience_id, 'booking created',
    p_actor_user_id, p_actor_name, p_actor_email
  );

  return created_booking_id;
end;
$$;

create or replace function public.crm_update_booking_payment(
  p_booking_id uuid,
  p_payment_status text,
  p_actor_user_id uuid,
  p_actor_name text,
  p_actor_email text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_booking public.crm_bookings%rowtype;
begin
  if p_payment_status not in ('unpaid', 'paid') then raise exception 'Invalid payment status'; end if;
  select * into current_booking from public.crm_bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if current_booking.payment_status = p_payment_status then return; end if;

  update public.crm_bookings set payment_status = p_payment_status, updated_at = now(), updated_by = p_actor_user_id
    where id = p_booking_id;
  insert into public.crm_activity_events (
    event_type, lead_id, booking_id, from_value, to_value, actor_user_id, actor_name, actor_email
  ) values (
    'payment_status', current_booking.lead_id, p_booking_id, current_booking.payment_status, p_payment_status,
    p_actor_user_id, p_actor_name, p_actor_email
  );
end;
$$;

alter table public.crm_staff_profiles enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_activity_events enable row level security;
alter table public.crm_experience_pricing enable row level security;
alter table public.crm_bookings enable row level security;

revoke all on table public.crm_staff_profiles, public.crm_leads, public.crm_activity_events,
  public.crm_experience_pricing, public.crm_bookings from anon, authenticated;
grant select on table public.crm_staff_profiles to authenticated;
grant all on table public.crm_staff_profiles, public.crm_leads, public.crm_activity_events,
  public.crm_experience_pricing, public.crm_bookings to service_role;

create policy crm_staff_profiles_read_self
  on public.crm_staff_profiles for select to authenticated
  using (user_id = (select auth.uid()));

-- Public website writes only new, consented form leads or identity-free WhatsApp intents.
-- It cannot read, update, delete, or create staff/manual CRM records.
grant insert (
  name, email, phone, experience_id, experience_slug, experience_title, preferred_date,
  group_size, language, interests, message, consent_given, source, channel
) on table public.crm_leads to anon;

create policy crm_website_insert_new_leads
  on public.crm_leads for insert to anon
  with check (
    status = 'new'
    and created_by is null
    and status_updated_at is null
    and status_updated_by is null
    and char_length(source) between 1 and 2048
    and (
      (channel = 'whatsapp' and name is null and email is null and phone is null and consent_given = false)
      or (channel = 'form' and consent_given = true)
    )
  );

revoke all on function public.crm_record_public_lead() from public, anon, authenticated;
revoke all on function public.crm_create_manual_lead(text, text, text, text, text, text, date, integer, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_update_lead_status(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_update_lead_contact(uuid, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_save_experience_pricing(text, text, text, bigint, numeric, bigint, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_create_booking(uuid, text, text, text, text, date, integer, text, bigint, bigint, uuid, text, text) from public, anon, authenticated;
revoke all on function public.crm_update_booking_payment(uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.crm_create_manual_lead(text, text, text, text, text, text, date, integer, text, uuid, text, text) to service_role;
grant execute on function public.crm_update_lead_status(uuid, text, uuid, text, text) to service_role;
grant execute on function public.crm_update_lead_contact(uuid, text, text, text, uuid, text, text) to service_role;
grant execute on function public.crm_save_experience_pricing(text, text, text, bigint, numeric, bigint, uuid, text, text) to service_role;
grant execute on function public.crm_create_booking(uuid, text, text, text, text, date, integer, text, bigint, bigint, uuid, text, text) to service_role;
grant execute on function public.crm_update_booking_payment(uuid, text, uuid, text, text) to service_role;
