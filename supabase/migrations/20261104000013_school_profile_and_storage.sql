-- School profile and branding fields.
--
-- The `schools` table is the tenant record, so profile and branding columns
-- live there rather than in a separate settings table. Row Level Security
-- already restricts reads to members and writes to `school.manage` holders.

alter table public.schools
  add column if not exists physical_address text,
  add column if not exists primary_phone text,
  add column if not exists secondary_phone text,
  add column if not exists official_email text,
  add column if not exists website text,
  add column if not exists logo_url text;

comment on column public.schools.physical_address is 'School postal/physical address.';
comment on column public.schools.primary_phone is 'Primary contact phone number.';
comment on column public.schools.secondary_phone is 'Secondary contact phone number.';
comment on column public.schools.official_email is 'Official school email address.';
comment on column public.schools.website is 'School website URL.';
comment on column public.schools.logo_url is 'Public URL of the school logo in the school-assets bucket.';
