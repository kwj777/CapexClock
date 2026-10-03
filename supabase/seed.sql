-- Component library. Mirrors src/verticals/landlord/library/components.ts (a test keeps them in sync).
-- Safe to re-run: existing slugs are left alone, so edits made in the dashboard stick.
-- Runs after the migrations; the typical cost columns come from 0005_typical_costs.sql.
insert into public.component_library
  (slug, category, name, default_useful_life_low, default_useful_life_high, default_unit_label, sort_order,
   typical_cost_low, typical_cost_high, typical_cost_per)
values
  ('asphalt-shingle-roof', 'Roofing', 'Asphalt shingle roof', 20, 25, 'per_building', 0, 2600, 4700, 'apartment'),
  ('flat-membrane-roof', 'Roofing', 'Flat / membrane roof', 15, 25, 'per_building', 1, 3000, 6000, 'apartment'),
  ('gutters', 'Roofing', 'Gutters and downspouts', 20, 30, 'per_building', 2, 200, 400, 'apartment'),
  ('gas-furnace', 'HVAC', 'Gas furnace', 15, 20, 'per_unit', 3, 2500, 5000, 'apartment'),
  ('central-ac', 'HVAC', 'Central AC / condenser', 12, 15, 'per_unit', 4, 3500, 6500, 'apartment'),
  ('heat-pump', 'HVAC', 'Heat pump', 12, 15, 'per_unit', 5, 4000, 7000, 'apartment'),
  ('boiler', 'HVAC', 'Boiler', 20, 30, 'per_building', 6, 1100, 2900, 'apartment'),
  ('tank-water-heater', 'Plumbing', 'Tank water heater', 8, 12, 'per_unit', 7, 800, 2300, 'apartment'),
  ('tankless-water-heater', 'Plumbing', 'Tankless water heater', 15, 20, 'per_unit', 8, 1400, 3900, 'apartment'),
  ('refrigerator', 'Appliances', 'Refrigerator', 10, 15, 'per_unit', 9, 700, 1300, 'apartment'),
  ('range-oven', 'Appliances', 'Range / oven', 13, 15, 'per_unit', 10, 600, 1300, 'apartment'),
  ('dishwasher', 'Appliances', 'Dishwasher', 9, 12, 'per_unit', 11, 500, 1100, 'apartment'),
  ('washer-dryer', 'Appliances', 'Washer / dryer', 10, 13, 'per_unit', 12, 900, 2000, 'apartment'),
  ('carpet', 'Flooring', 'Carpet', 5, 10, 'per_sq_ft', 13, 3, 6, 'sq_ft'),
  ('luxury-vinyl-plank', 'Flooring', 'Luxury vinyl plank', 15, 25, 'per_sq_ft', 14, 4, 8, 'sq_ft'),
  ('interior-paint', 'Interior', 'Interior paint (turnover)', 3, 7, 'per_unit', 15, 1800, 3600, 'apartment'),
  ('kitchen-cabinets', 'Interior', 'Kitchen cabinets', 20, 30, 'per_unit', 16, 2000, 6000, 'apartment'),
  ('laminate-countertops', 'Interior', 'Laminate countertops', 15, 20, 'per_unit', 17, 500, 1500, 'apartment'),
  ('vinyl-windows', 'Exterior', 'Windows (vinyl)', 20, 30, 'per_unit', 18, 3200, 7200, 'apartment'),
  ('exterior-paint', 'Exterior', 'Exterior paint', 7, 10, 'per_building', 19, 900, 2800, 'apartment'),
  ('vinyl-siding', 'Exterior', 'Vinyl siding', 20, 40, 'per_building', 20, 1600, 3200, 'apartment'),
  ('parking-lot-seal-coat', 'Site', 'Parking lot seal coat', 3, 5, 'per_sq_ft', 21, 0.15, 0.3, 'sq_ft'),
  ('parking-lot-resurface', 'Site', 'Parking lot resurface', 15, 20, 'per_sq_ft', 22, 2, 4, 'sq_ft'),
  ('electrical-panel', 'Electrical', 'Electrical panel', 25, 40, 'per_unit', 23, 1000, 2500, 'apartment'),
  ('fire-alarm-panel', 'Safety', 'Fire alarm panel', 15, 20, 'per_building', 24, 250, 850, 'apartment')
on conflict (slug) do nothing;
