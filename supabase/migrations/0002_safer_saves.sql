-- CapexClock 0002: safer saves. Run once in the Supabase SQL editor after 0001.
-- It's safe to run again, and the app works both before and after it runs.
--
-- 1. save_property takes an optional p_expected_updated_at. When it's sent and the
--    property was saved since (in another tab or on another device), the save is
--    refused with SQLSTATE PT409 (HTTP 409) instead of overwriting the newer copy.
--    Callers that don't send it work exactly as before.
-- 2. Quantities and costs must be finite: numeric accepts 'NaN' and 'Infinity',
--    which passed the old checks and broke the forecast.
-- 3. A service record's asset must belong to the record's own component, so a
--    record can't point at another owner's asset.

-- 1. Saving a property, with an optional version check ------------------------

-- Replaced by the three-argument version below. Keeping both would make two-argument
-- calls ambiguous, so the old one goes.
drop function if exists public.save_property(jsonb, jsonb);

-- Creates or updates a property and its components in one transaction. Components
-- keep their id when it's sent (so later assets and service records stay attached);
-- ones not sent are deleted. Runs as the caller (security invoker), so Row Level
-- Security still applies.
create or replace function public.save_property(
  p_property jsonb,
  p_components jsonb,
  p_expected_updated_at timestamptz default null
) returns uuid
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
    where id = v_id
      and (p_expected_updated_at is null or updated_at = p_expected_updated_at);
    if not found then
      -- Still there, so it was saved since the caller loaded it.
      if exists (select 1 from public.properties p where p.id = v_id) then
        raise exception 'Property was changed since it was loaded' using errcode = 'PT409';
      end if;
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

revoke execute on function public.save_property(jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.save_property(jsonb, jsonb, timestamptz) to authenticated;

-- 2. Finite quantities and costs -----------------------------------------------

-- NaN sorts above every number and Infinity is above any bound, so an upper bound
-- rejects both.
alter table public.components drop constraint if exists components_quantity_check;
alter table public.components add constraint components_quantity_check
  check (quantity > 0 and quantity < 1e9) not valid;

alter table public.components drop constraint if exists components_replacement_cost_each_check;
alter table public.components add constraint components_replacement_cost_each_check
  check (replacement_cost_each >= 0 and replacement_cost_each < 1e12) not valid;

alter table public.service_records drop constraint if exists service_records_cost_check;
alter table public.service_records add constraint service_records_cost_check
  check (cost >= 0 and cost < 1e12) not valid;

-- 3. A service record's asset belongs to the same component ---------------------

alter table public.service_records drop constraint if exists service_records_asset_id_fkey;
alter table public.assets drop constraint if exists assets_id_component_id_key;
alter table public.assets add constraint assets_id_component_id_key unique (id, component_id);
alter table public.service_records add constraint service_records_asset_id_fkey
  foreign key (asset_id, component_id) references public.assets (id, component_id)
  on delete set null (asset_id) not valid;

-- Check the rows already saved. If an old row breaks a new rule, the rule still
-- applies to every new save and that row is left as it is (the app skips it).
do $$
declare
  v record;
begin
  for v in
    select * from (values
      ('components', 'components_quantity_check'),
      ('components', 'components_replacement_cost_each_check'),
      ('service_records', 'service_records_cost_check'),
      ('service_records', 'service_records_asset_id_fkey')
    ) as t (table_name, constraint_name)
  loop
    begin
      execute format('alter table public.%I validate constraint %I', v.table_name, v.constraint_name);
    exception when check_violation or foreign_key_violation then
      raise notice 'Some existing % rows break %. New saves are still checked.',
        v.table_name, v.constraint_name;
    end;
  end loop;
end;
$$;

-- Tell the API about the new save_property signature straight away.
notify pgrst, 'reload schema';
