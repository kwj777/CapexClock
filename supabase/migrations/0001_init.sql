-- CapexClock initial schema. Run once in the Supabase SQL editor (or `supabase db push`).
-- Every table has Row Level Security: an owner can only ever see or change their own rows.

create type public.unit_label as enum ('per_unit', 'per_building', 'per_sq_ft');
create type public.component_condition as enum ('good', 'fair', 'poor');
create type public.replacement_scenario as enum ('run_to_failure', 'replace_now');
create type public.team_role as enum ('owner', 'editor', 'viewer');

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Properties -----------------------------------------------------------------

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  city text check (char_length(city) <= 100),
  state text check (char_length(state) <= 50),
  unit_count integer not null default 0 check (unit_count between 0 and 100000),
  year_built integer check (year_built between 1800 and 2200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index properties_user_id_idx on public.properties (user_id);
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- Components (one row per component type, with a quantity) -------------------

create table public.components (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  library_slug text,
  category text not null check (char_length(category) between 1 and 100),
  name text not null check (char_length(name) between 1 and 200),
  quantity numeric not null check (quantity > 0),
  unit_label public.unit_label not null default 'per_building',
  -- Null means "use the property's year built" and is shown as an estimate.
  install_year integer check (install_year between 1800 and 2200),
  useful_life_years integer not null check (useful_life_years between 1 and 100),
  -- Null until the owner enters a cost; such rows are listed but not forecast.
  replacement_cost_each numeric check (replacement_cost_each >= 0),
  condition public.component_condition,
  notes text check (char_length(notes) <= 2000),
  scenario public.replacement_scenario not null default 'run_to_failure',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index components_property_id_idx on public.components (property_id);
create trigger components_updated_at before update on public.components
  for each row execute function public.set_updated_at();

-- Shared component library (read-only to the app; edit in the Supabase dashboard)

create table public.component_library (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  category text not null,
  name text not null,
  default_useful_life_low integer not null check (default_useful_life_low between 1 and 100),
  default_useful_life_high integer not null check (default_useful_life_high between 1 and 100),
  default_unit_label public.unit_label not null,
  description text,
  sort_order integer not null default 0,
  check (default_useful_life_low <= default_useful_life_high)
);

-- Later features (schema only, no UI yet) ------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.team_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (property_id, user_id)
);
create index team_members_user_id_idx on public.team_members (user_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete cascade,
  brand text,
  model text,
  serial text,
  photo_path text,
  install_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assets_component_id_idx on public.assets (component_id);
create trigger assets_updated_at before update on public.assets
  for each row execute function public.set_updated_at();

create table public.service_records (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  service_date date not null,
  description text not null,
  cost numeric check (cost >= 0),
  created_at timestamptz not null default now()
);
create index service_records_component_id_idx on public.service_records (component_id);
create index service_records_asset_id_idx on public.service_records (asset_id);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references public.components (id) on delete cascade,
  remind_on date not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index reminders_component_id_idx on public.reminders (component_id);

-- Row Level Security ----------------------------------------------------------

alter table public.properties enable row level security;
alter table public.components enable row level security;
alter table public.component_library enable row level security;
alter table public.team_members enable row level security;
alter table public.assets enable row level security;
alter table public.service_records enable row level security;
alter table public.reminders enable row level security;

-- True when the signed-in user owns the property. Security definer so policies on
-- child tables don't recurse through the properties policies.
create function public.owns_property(p_property_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.properties p
    where p.id = p_property_id and p.user_id = (select auth.uid())
  );
$$;

create function public.owns_component(p_component_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.components c
    join public.properties p on p.id = c.property_id
    where c.id = p_component_id and p.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_property(uuid) from public, anon;
revoke execute on function public.owns_component(uuid) from public, anon;
grant execute on function public.owns_property(uuid) to authenticated;
grant execute on function public.owns_component(uuid) to authenticated;

create policy "Owners manage their properties" on public.properties
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Owners manage components of their properties" on public.components
  for all to authenticated
  using ((select public.owns_property(property_id)))
  with check ((select public.owns_property(property_id)));

create policy "Anyone can read the component library" on public.component_library
  for select to anon, authenticated
  using (true);

-- Team access is not built yet: owners manage members, members see their own rows.
create policy "Owners manage team members" on public.team_members
  for all to authenticated
  using ((select public.owns_property(property_id)))
  with check ((select public.owns_property(property_id)));
create policy "Members see their memberships" on public.team_members
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Owners manage assets" on public.assets
  for all to authenticated
  using ((select public.owns_component(component_id)))
  with check ((select public.owns_component(component_id)));

create policy "Owners manage service records" on public.service_records
  for all to authenticated
  using ((select public.owns_component(component_id)))
  with check ((select public.owns_component(component_id)));

create policy "Owners manage reminders" on public.reminders
  for all to authenticated
  using ((select public.owns_component(component_id)))
  with check ((select public.owns_component(component_id)));

-- Saving a property ----------------------------------------------------------

-- Creates or updates a property and its components in one transaction. Components
-- keep their id when it's sent (so later assets and service records stay attached);
-- ones not sent are deleted. Runs as the caller (security invoker), so the
-- policies above still apply.
create function public.save_property(p_property jsonb, p_components jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_id uuid := nullif(p_property->>'id', '')::uuid;
  v_keep uuid[];
begin
  if v_id is null then
    insert into public.properties (name, city, state, unit_count, year_built)
    values (
      p_property->>'name',
      nullif(p_property->>'city', ''),
      nullif(p_property->>'state', ''),
      coalesce((p_property->>'unit_count')::integer, 0),
      (p_property->>'year_built')::integer
    )
    returning id into v_id;
  else
    update public.properties set
      name = p_property->>'name',
      city = nullif(p_property->>'city', ''),
      state = nullif(p_property->>'state', ''),
      unit_count = coalesce((p_property->>'unit_count')::integer, 0),
      year_built = (p_property->>'year_built')::integer
    where id = v_id;
    if not found then
      raise exception 'Property not found' using errcode = 'P0002';
    end if;
  end if;

  -- Components already on this property that the caller is keeping.
  select coalesce(array_agg(c.id), '{}') into v_keep
  from public.components c
  where c.property_id = v_id
    and c.id in (select i.id from jsonb_to_recordset(coalesce(p_components, '[]'::jsonb)) as i(
    id uuid, library_slug text, category text, name text, quantity numeric,
    unit_label public.unit_label, install_year integer, useful_life_years integer,
    replacement_cost_each numeric, scenario public.replacement_scenario, sort_order integer
  ));

  delete from public.components c where c.property_id = v_id and c.id <> all (v_keep);

  update public.components c set
    library_slug = i.library_slug,
    category = i.category,
    name = i.name,
    quantity = i.quantity,
    unit_label = i.unit_label,
    install_year = i.install_year,
    useful_life_years = i.useful_life_years,
    replacement_cost_each = i.replacement_cost_each,
    scenario = coalesce(i.scenario, 'run_to_failure'),
    sort_order = coalesce(i.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_components, '[]'::jsonb)) as i(
    id uuid, library_slug text, category text, name text, quantity numeric,
    unit_label public.unit_label, install_year integer, useful_life_years integer,
    replacement_cost_each numeric, scenario public.replacement_scenario, sort_order integer
  )
  where c.id = i.id and c.id = any (v_keep);

  insert into public.components (
    property_id, library_slug, category, name, quantity, unit_label, install_year,
    useful_life_years, replacement_cost_each, scenario, sort_order
  )
  select
    v_id, i.library_slug, i.category, i.name, i.quantity, i.unit_label, i.install_year,
    i.useful_life_years, i.replacement_cost_each, coalesce(i.scenario, 'run_to_failure'),
    coalesce(i.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_components, '[]'::jsonb)) as i(
    id uuid, library_slug text, category text, name text, quantity numeric,
    unit_label public.unit_label, install_year integer, useful_life_years integer,
    replacement_cost_each numeric, scenario public.replacement_scenario, sort_order integer
  )
  where i.id is null or not (i.id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_property(jsonb, jsonb) from public, anon;
grant execute on function public.save_property(jsonb, jsonb) to authenticated;
