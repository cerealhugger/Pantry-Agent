-- ─── Seed data for Pantry Agent ──────────────────────────────────────────────
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Assumes tables already exist and RLS is disabled (see CLAUDE.md).

-- ─── 1. inventory_items (10 items, sorted by how soon they expire) ────────────

insert into inventory_items
  (user_id, name, quantity, unit, category, purchase_date, expiry_date)
values
  -- expires very soon (within 3 days)
  ('demo', 'Spinach',        1,    'bag',   'vegetable', current_date - 4, current_date + 1),
  ('demo', 'Ground Beef',    300,  'g',     'meat',      current_date - 2, current_date + 2),
  ('demo', 'Heavy Cream',    200,  'ml',    'dairy',     current_date - 3, current_date + 2),

  -- expires in ~1 week
  ('demo', 'Eggs',           6,    'pcs',   'dairy',     current_date - 1, current_date + 6),
  ('demo', 'Cherry Tomatoes',200,  'g',     'vegetable', current_date - 2, current_date + 5),
  ('demo', 'Broccoli',       1,    'head',  'vegetable', current_date - 1, current_date + 6),

  -- expires in ~2 weeks
  ('demo', 'Chicken Breast', 400,  'g',     'meat',      current_date,     current_date + 10),
  ('demo', 'Cheddar Cheese', 150,  'g',     'dairy',     current_date,     current_date + 14),

  -- pantry staples (long shelf life)
  ('demo', 'Pasta',          500,  'g',     'pantry',    current_date - 10, current_date + 180),
  ('demo', 'Olive Oil',      500,  'ml',    'pantry',    current_date - 30, current_date + 365);


-- ─── 2. recipes (6 recipes, ingredients overlap with expiring inventory) ──────

insert into recipes
  (user_id, title, ingredients, steps, calories_per_serving, servings, tags, source_type)
values

  -- uses spinach + eggs (both expiring soon)
  ('demo', 'Spinach & Egg Scramble',
   '[
     {"name":"Spinach","qty":1,"unit":"handful"},
     {"name":"Eggs","qty":3,"unit":"pcs"},
     {"name":"Olive Oil","qty":1,"unit":"tbsp"},
     {"name":"Cheddar Cheese","qty":30,"unit":"g"}
   ]'::jsonb,
   '["Heat olive oil in a pan over medium heat.",
     "Add spinach and sauté until wilted, about 2 minutes.",
     "Whisk eggs, pour into pan, and scramble until just set.",
     "Top with cheddar cheese and serve."]'::jsonb,
   320, 1,
   '["quick","high-protein","breakfast"]'::jsonb,
   'seed'),

  -- uses ground beef + cherry tomatoes (both expiring soon)
  ('demo', 'Beef & Tomato Pasta',
   '[
     {"name":"Ground Beef","qty":300,"unit":"g"},
     {"name":"Cherry Tomatoes","qty":200,"unit":"g"},
     {"name":"Pasta","qty":200,"unit":"g"},
     {"name":"Olive Oil","qty":2,"unit":"tbsp"}
   ]'::jsonb,
   '["Cook pasta according to package instructions; drain.",
     "Brown ground beef in a large pan over high heat, season with salt and pepper.",
     "Add cherry tomatoes and cook until they burst, about 5 minutes.",
     "Toss pasta with the beef-tomato sauce and serve."]'::jsonb,
   620, 2,
   '["quick","high-protein","dinner"]'::jsonb,
   'seed'),

  -- uses heavy cream + eggs (both expiring soon)
  ('demo', 'Classic French Omelette',
   '[
     {"name":"Eggs","qty":3,"unit":"pcs"},
     {"name":"Heavy Cream","qty":2,"unit":"tbsp"},
     {"name":"Olive Oil","qty":1,"unit":"tsp"},
     {"name":"Cheddar Cheese","qty":20,"unit":"g"}
   ]'::jsonb,
   '["Whisk eggs with heavy cream until smooth.",
     "Heat oil in a non-stick pan over medium-low heat.",
     "Pour in egg mixture; gently fold edges inward as it sets.",
     "Sprinkle cheese on one half, fold omelette over, and slide onto plate."]'::jsonb,
   380, 1,
   '["quick","breakfast","low-carb"]'::jsonb,
   'seed'),

  -- uses broccoli + chicken breast
  ('demo', 'Garlic Chicken & Broccoli Stir-fry',
   '[
     {"name":"Chicken Breast","qty":400,"unit":"g"},
     {"name":"Broccoli","qty":1,"unit":"head"},
     {"name":"Olive Oil","qty":2,"unit":"tbsp"}
   ]'::jsonb,
   '["Slice chicken into thin strips; season with salt, pepper, and garlic.",
     "Heat oil in a wok or large pan over high heat.",
     "Stir-fry chicken until golden, about 4 minutes; set aside.",
     "Add broccoli florets and stir-fry 3 minutes until bright green.",
     "Return chicken to pan, toss together, and serve over rice."]'::jsonb,
   450, 2,
   '["high-protein","dinner","meal-prep"]'::jsonb,
   'seed'),

  -- uses spinach + cherry tomatoes + eggs (3 expiring ingredients!)
  ('demo', 'Baked Shakshuka',
   '[
     {"name":"Eggs","qty":4,"unit":"pcs"},
     {"name":"Cherry Tomatoes","qty":200,"unit":"g"},
     {"name":"Spinach","qty":1,"unit":"handful"},
     {"name":"Olive Oil","qty":1,"unit":"tbsp"}
   ]'::jsonb,
   '["Preheat oven to 190°C (375°F).",
     "Heat oil in an oven-safe skillet; add cherry tomatoes and cook until soft.",
     "Stir in spinach until wilted.",
     "Make 4 small wells in the mixture; crack an egg into each well.",
     "Transfer to oven and bake 8–10 minutes until whites are set.",
     "Serve directly from the skillet with crusty bread."]'::jsonb,
   280, 2,
   '["vegetarian","brunch","dinner"]'::jsonb,
   'seed'),

  -- uses broccoli + cheddar + heavy cream
  ('demo', 'Broccoli Cheddar Soup',
   '[
     {"name":"Broccoli","qty":1,"unit":"head"},
     {"name":"Cheddar Cheese","qty":120,"unit":"g"},
     {"name":"Heavy Cream","qty":150,"unit":"ml"},
     {"name":"Olive Oil","qty":1,"unit":"tbsp"}
   ]'::jsonb,
   '["Chop broccoli into small florets.",
     "Heat oil in a pot; add broccoli and sauté 3 minutes.",
     "Add 500ml water (or stock), bring to a boil, simmer 10 minutes.",
     "Blend until smooth with an immersion blender.",
     "Stir in heavy cream and cheddar over low heat until melted.",
     "Season with salt, pepper, and a pinch of nutmeg."]'::jsonb,
   390, 2,
   '["vegetarian","soup","comfort-food"]'::jsonb,
   'seed');
