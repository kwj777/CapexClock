-- CapexClock 0004: condition, notes and "install year is a guess". Run once in the Supabase
-- SQL editor, after 0002_safer_saves.sql and 0003_library_checks.sql.
-- It's safe to run again, and the site works both before and after it runs. Before it runs,
-- the property editor says condition and notes weren't saved.
--
-- 1. components.install_year_is_estimate: the owner ticked "guess" next to the install year.
-- 2. save_property also saves each component's condition, notes and that flag. Each one is
--    only changed when the app sends it, so a copy of the app from before this update (say,
--    a tab left open since then) leaves them as they are. New rows sent without them get
--    the defaults: no condition, no notes, not a guess.
--
-- The condition choices (good, fair, poor) and the 2,000-character limit on notes are the
-- ones from 0001 and don't change.
--
-- Don't run 0002 again after this: it would bring back a save_property that ignores
-- condition and notes. If that happens, run this file again.

-- This replaces 0002's version of save_property, so 0002 has to have run.
do $$
begin
  if to_regprocedure('public.save_property(jsonb, jsonb, timestamptz)') is null then
    raise exception 'Run 0002_safer_saves.sql first';
  end if;
end;
$$;

-- 0001's two-argument version. 0002 drops it too; dropping it here as well means this file
-- can never leave two versions side by side, which would make calls ambiguous.
drop function if exists public.save_property(jsonb, jsonb);

-- 1. The "guess" flag ---------------------------------------------------------

alter table public.components
  add column if not exists install_year_is_estimate boolean not null default false;

-- 2. Saving a property, with condition, notes and the flag ---------------------

-- Creates or updates a property and its components in one transaction. Components
-- keep their id when it's sent (so later assets and service records stay attached);
-- ones not sent are deleted. Runs as the caller (security invoker), so Row Level
-- Security still applies. Same inputs and version check as 0002.
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
    replacement_cost_each numeric, condition public.component_condition, notes text,
    install_year_is_estimate boolean, scenario public.replacement_scenario, sort_order integer
  ));

  delete from public.components c where c.property_id = v_id and c.id <> all (v_keep);

  -- Each sent component is read twice: as typed fields (i), and as it was sent (e.elem),
  -- to tell a missing key (leave the saved value alone) from one sent as null (clear it).
  update public.components c set
    library_slug = i.library_slug,
    category = i.category,
    name = i.name,
    quantity = i.quantity,
    unit_label = i.unit_label,
    install_year = i.install_year,
    useful_life_years = i.useful_life_years,
    replacement_cost_each = i.replacement_cost_each,
    condition = case when e.elem ? 'condition' then i.condition else c.condition end,
    notes = case when e.elem ? 'notes' then i.notes else c.notes end,
    install_year_is_estimate = case
      when e.elem ? 'install_year_is_estimate' then coalesce(i.install_year_is_estimate, false)
      else c.install_year_is_estimate
    end,
    scenario = coalesce(i.scenario, 'run_to_failure'),
    sort_order = coalesce(i.sort_order, 0)
  from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) as e (elem)
  cross join lateral jsonb_to_record(e.elem) as i(
    id uuid, library_slug text, category text, name text, quantity numeric,
    unit_label public.unit_label, install_year integer, useful_life_years integer,
    replacement_cost_each numeric, condition public.component_condition, notes text,
    install_year_is_estimate boolean, scenario public.replacement_scenario, sort_order integer
  )
  where c.id = i.id and c.id = any (v_keep);

  -- New rows: a missing condition or notes is null (the column default), and a missing
  -- flag is false.
  insert into public.components (
    property_id, library_slug, category, name, quantity, unit_label, install_year,
    useful_life_years, replacement_cost_each, condition, notes, install_year_is_estimate,
    scenario, sort_order
  )
  select
    v_id, i.library_slug, i.category, i.name, i.quantity, i.unit_label, i.install_year,
    i.useful_life_years, i.replacement_cost_each, i.condition, i.notes,
    coalesce(i.install_year_is_estimate, false), coalesce(i.scenario, 'run_to_failure'),
    coalesce(i.sort_order, 0)
  from jsonb_to_recordset(coalesce(p_components, '[]'::jsonb)) as i(
    id uuid, library_slug text, category text, name text, quantity numeric,
    unit_label public.unit_label, install_year integer, useful_life_years integer,
    replacement_cost_each numeric, condition public.component_condition, notes text,
    install_year_is_estimate boolean, scenario public.replacement_scenario, sort_order integer
  )
  where i.id is null or not (i.id = any (v_keep));

  return v_id;
end;
$$;

revoke execute on function public.save_property(jsonb, jsonb, timestamptz) from public, anon;
grant execute on function public.save_property(jsonb, jsonb, timestamptz) to authenticated;

-- Tell the API about the new column straight away.
notify pgrst, 'reload schema';
