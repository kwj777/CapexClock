-- Component library. Mirrors src/lib/library/components.ts (a test keeps them in sync).
-- Safe to re-run: existing slugs are left alone, so edits made in the dashboard stick.
insert into public.component_library
  (slug, category, name, default_useful_life_low, default_useful_life_high, default_unit_label, sort_order)
values
  ('asphalt-shingle-roof', 'Roofing', 'Asphalt shingle roof', 20, 25, 'per_building', 0),
  ('flat-membrane-roof', 'Roofing', 'Flat / membrane roof', 15, 25, 'per_building', 1),
  ('gutters', 'Roofing', 'Gutters and downspouts', 20, 30, 'per_building', 2),
  ('gas-furnace', 'HVAC', 'Gas furnace', 15, 20, 'per_unit', 3),
  ('central-ac', 'HVAC', 'Central AC / condenser', 12, 15, 'per_unit', 4),
  ('heat-pump', 'HVAC', 'Heat pump', 12, 15, 'per_unit', 5),
  ('boiler', 'HVAC', 'Boiler', 20, 30, 'per_building', 6),
  ('tank-water-heater', 'Plumbing', 'Tank water heater', 8, 12, 'per_unit', 7),
  ('tankless-water-heater', 'Plumbing', 'Tankless water heater', 15, 20, 'per_unit', 8),
  ('refrigerator', 'Appliances', 'Refrigerator', 10, 15, 'per_unit', 9),
  ('range-oven', 'Appliances', 'Range / oven', 13, 15, 'per_unit', 10),
  ('dishwasher', 'Appliances', 'Dishwasher', 9, 12, 'per_unit', 11),
  ('washer-dryer', 'Appliances', 'Washer / dryer', 10, 13, 'per_unit', 12),
  ('carpet', 'Flooring', 'Carpet', 5, 10, 'per_sq_ft', 13),
  ('luxury-vinyl-plank', 'Flooring', 'Luxury vinyl plank', 15, 25, 'per_sq_ft', 14),
  ('interior-paint', 'Interior', 'Interior paint (turnover)', 3, 7, 'per_unit', 15),
  ('kitchen-cabinets', 'Interior', 'Kitchen cabinets', 20, 30, 'per_unit', 16),
  ('laminate-countertops', 'Interior', 'Laminate countertops', 15, 20, 'per_unit', 17),
  ('vinyl-windows', 'Exterior', 'Windows (vinyl)', 20, 30, 'per_unit', 18),
  ('exterior-paint', 'Exterior', 'Exterior paint', 7, 10, 'per_building', 19),
  ('vinyl-siding', 'Exterior', 'Vinyl siding', 20, 40, 'per_building', 20),
  ('parking-lot-seal-coat', 'Site', 'Parking lot seal coat', 3, 5, 'per_sq_ft', 21),
  ('parking-lot-resurface', 'Site', 'Parking lot resurface', 15, 20, 'per_sq_ft', 22),
  ('electrical-panel', 'Electrical', 'Electrical panel', 25, 40, 'per_unit', 23),
  ('fire-alarm-panel', 'Safety', 'Fire alarm panel', 15, 20, 'per_building', 24)
on conflict (slug) do nothing;
