-- CapexClock 0005: typical replacement costs. Run once in the Supabase SQL editor, after the
-- earlier migrations.
-- It's safe to run again (a second run changes no costs), and the site works both before and
-- after it runs.
--
-- Adds a typical installed cost range (today's dollars) to each component in the library. The
-- quick estimate on /reserve-calculator uses them, and the calculator shows them as grey hints
-- under a cost field. They're never used in a property's forecast or saved to one. Until this
-- runs, the site uses the same numbers from src/lib/library/components.ts.
--
-- typical_cost_per says what one cost pays for:
--   apartment: one apartment's worth. Building-wide items (roofs, boilers, siding) are priced
--              per apartment for a 12-unit, two-story building.
--   sq_ft:     one square foot (carpet, vinyl plank and parking lots).
-- Leave all three cells blank on a row to keep it out of the quick estimate and the hints.
-- Sources and assumptions are in typical-costs.md, which Kevin approved.

-- Adds the columns and, only on the run that adds them, fills in the built-in components. So
-- running this again never puts back a cost edited or blanked in the dashboard. It's one block,
-- so either all of it happens or none of it does.
do $$
declare
  first_run boolean := not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public' and table_name = 'component_library' and column_name = 'typical_cost_low'
  );
begin
  alter table public.component_library add column if not exists typical_cost_low numeric;
  alter table public.component_library add column if not exists typical_cost_high numeric;
  alter table public.component_library add column if not exists typical_cost_per text;

  if not first_run then
    raise notice 'The typical cost columns were already there, so no costs were changed.';
    return;
  end if;

  update public.component_library as c
  set typical_cost_low = v.low, typical_cost_high = v.high, typical_cost_per = v.per
  from (
    values
      ('asphalt-shingle-roof', 2600, 4700, 'apartment'),
      ('flat-membrane-roof', 3000, 6000, 'apartment'),
      ('gutters', 200, 400, 'apartment'),
      ('gas-furnace', 2500, 5000, 'apartment'),
      ('central-ac', 3500, 6500, 'apartment'),
      ('heat-pump', 4000, 7000, 'apartment'),
      ('boiler', 1100, 2900, 'apartment'),
      ('tank-water-heater', 800, 2300, 'apartment'),
      ('tankless-water-heater', 1400, 3900, 'apartment'),
      ('refrigerator', 700, 1300, 'apartment'),
      ('range-oven', 600, 1300, 'apartment'),
      ('dishwasher', 500, 1100, 'apartment'),
      ('washer-dryer', 900, 2000, 'apartment'),
      ('carpet', 3, 6, 'sq_ft'),
      ('luxury-vinyl-plank', 4, 8, 'sq_ft'),
      ('interior-paint', 1800, 3600, 'apartment'),
      ('kitchen-cabinets', 2000, 6000, 'apartment'),
      ('laminate-countertops', 500, 1500, 'apartment'),
      ('vinyl-windows', 3200, 7200, 'apartment'),
      ('exterior-paint', 900, 2800, 'apartment'),
      ('vinyl-siding', 1600, 3200, 'apartment'),
      ('parking-lot-seal-coat', 0.15, 0.3, 'sq_ft'),
      ('parking-lot-resurface', 2, 4, 'sq_ft'),
      ('electrical-panel', 1000, 2500, 'apartment'),
      ('fire-alarm-panel', 250, 850, 'apartment')
  ) as v (slug, low, high, per)
  where c.slug = v.slug;
end;
$$;

-- All three blank, or all three filled in with 0 <= low <= high < 1 billion. The same rule as
-- parseTypicalCostRows in src/lib/library/source.ts, so the table editor refuses a row the site
-- would skip.
alter table public.component_library drop constraint if exists component_library_typical_cost_check;
alter table public.component_library add constraint component_library_typical_cost_check check (
  num_nonnulls(typical_cost_low, typical_cost_high, typical_cost_per) = 0
  or (
    num_nonnulls(typical_cost_low, typical_cost_high, typical_cost_per) = 3
    and typical_cost_per in ('apartment', 'sq_ft')
    and typical_cost_low >= 0
    and typical_cost_low <= typical_cost_high
    and typical_cost_high < 1e9
  )
) not valid;

-- Check the rows already there. If an old row breaks the rule, the rule still applies to every
-- new or edited row and that row is left as it is (the site skips its cost and logs why).
do $$
begin
  alter table public.component_library validate constraint component_library_typical_cost_check;
exception when check_violation then
  raise notice 'Some existing component_library rows break component_library_typical_cost_check. Fix them in the table editor.';
end;
$$;
