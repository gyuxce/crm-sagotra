-- The website may read only public sale prices. Cost and markup remain private.
create or replace function public.crm_public_experience_prices()
returns table (
  experience_id text,
  experience_slug text,
  sale_price bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public, pg_temp
as $$
  select pricing.experience_id, pricing.experience_slug, pricing.sale_price
  from public.crm_experience_pricing as pricing;
$$;

revoke all on function public.crm_public_experience_prices() from public, anon, authenticated;
grant execute on function public.crm_public_experience_prices() to anon;
