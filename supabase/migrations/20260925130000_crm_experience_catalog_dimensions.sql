-- Denormalized reporting dimensions, sourced once from Sanity at creation time.
-- These are for CRM-side segmentation only; Sanity remains the source of truth
-- for the content itself.
alter table public.crm_experiences
  add column category text check (category in ('heritage', 'arts', 'culinary', 'community')),
  add column destination_slug text;
