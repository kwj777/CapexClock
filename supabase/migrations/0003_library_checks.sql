-- CapexClock 0003: component library checks. Run once in the Supabase SQL editor, after the
-- earlier migrations.
-- It's safe to run again, and the site works both before and after it runs.
--
-- The site skips component_library rows it can't use (src/lib/library/source.ts), so a
-- bad row used to save without complaint and then never show up anywhere. With these
-- checks the table editor refuses the row when it's entered instead:
-- 1. A slug is lower-case letters, numbers and hyphens only, since it becomes the
--    page address (/lifespan/<slug>). Same pattern as SLUG_PATTERN in source.ts.
-- 2. Name and category each need at least one letter or number, so a page never reads
--    "How long does a ? last?".

alter table public.component_library drop constraint if exists component_library_slug_check;
alter table public.component_library add constraint component_library_slug_check
  check (slug ~ '^[a-z0-9-]+$') not valid;

alter table public.component_library drop constraint if exists component_library_name_check;
alter table public.component_library add constraint component_library_name_check
  check (name ~ '[[:alnum:]]' and category ~ '[[:alnum:]]') not valid;

-- Check the rows already there. If an old row breaks a rule, the rule still applies to
-- every new or edited row and that row is left as it is (the site skips it and logs why).
do $$
declare
  v text;
begin
  foreach v in array array['component_library_slug_check', 'component_library_name_check']
  loop
    begin
      execute format('alter table public.component_library validate constraint %I', v);
    exception when check_violation then
      raise notice 'Some existing component_library rows break %. Fix them in the table editor.', v;
    end;
  end loop;
end;
$$;
