# CLAUDE.md — Waste-Aware Meal Planning Agent

> Working title, rename freely. This file is the project's shared brain — Claude Code
> reads it every session. Keep it accurate; if a decision changes, update this file.

## What we're building

A meal-planning agent that ties together three things normal apps keep separate:
**inventory + recipes + calorie tracking**. The differentiator is the *loop*, not any
single feature.

Core loop:
`inventory → recipe → record → shopping list → (back to inventory)`

1. **Inventory** — user photographs a grocery receipt; we extract items + estimate
   shelf life; items are sorted by how soon they expire.
2. **Recipe** — we suggest a meal plan that *prioritizes soon-to-expire ingredients*
   and *prefers recipes the user saved* over AI-generated ones. (This prioritization
   logic is the soul of the product — do not treat it as an afterthought.)
3. **Record** — cooking a recipe auto-deducts inventory + logs calories; eating out =
   photograph the food, estimate calories, log it.
4. **Shopping list** — next week's plan minus current inventory = what to buy.

One-liner: *Turn the groceries you already have into actionable, low-waste meals.*

Hackathon track: **Ddoski's World (social impact)**.

## Tech stack (locked — do not add more without a reason)

- **Next.js (App Router) + TypeScript + Tailwind CSS** — frontend + backend API routes
  in one app.
- **Supabase (Postgres)** — data storage. Use the `@supabase/supabase-js` client.
- **Anthropic Claude API** — all "thinking" work: parse receipts (vision), generate
  recipes, estimate calories, structure scraped recipe text. Model string:
  `claude-sonnet-4-6`.
- **Vercel** — deployment.

Stretch (only after the main loop works — see Build Order):
- **Redis** — recipe "memory" / vector search (qualifies for the Redis prize).
- **Browserbase + Stagehand** — extract recipes from YouTube links (qualifies for the
  Browserbase prize).

## Environment variables (`.env.local`)

```
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
# stretch only:
# REDIS_URL=...
# BROWSERBASE_API_KEY=...
# BROWSERBASE_PROJECT_ID=...
```

Never commit `.env.local`. Make sure it is in `.gitignore`.

---

## DATABASE — do this first

Run the following in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query).
This is the first task; everything else builds on it.

```sql
-- inventory: what's in the kitchen right now
create table inventory_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null default 'demo',
  name          text not null,                 -- "tomato"
  quantity      numeric,                        -- 3   (null is fine)
  unit          text,                           -- "pcs" / "g" / "bunch"
  category      text,                           -- vegetable / meat / dairy / pantry
  purchase_date date not null default current_date,
  expiry_date   date,                           -- estimated by Claude
  created_at    timestamptz not null default now()
);

-- recipes: both seeded and user-saved. lists live in jsonb (don't make child tables)
create table recipes (
  id                   uuid primary key default gen_random_uuid(),
  user_id              text not null default 'demo',
  title                text not null,
  ingredients          jsonb not null default '[]',   -- [{name, qty, unit}, ...]
  steps                jsonb not null default '[]',   -- ["chop tomato", "fry", ...]
  calories_per_serving integer,
  servings             integer default 1,
  tags                 jsonb default '[]',            -- ["quick","high-protein"]
  source_type          text default 'seed',           -- seed/manual/youtube/xiaohongshu
  source_url           text,
  created_at           timestamptz not null default now()
);

-- diet log: one row per meal eaten
create table diet_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null default 'demo',
  log_date    date not null default current_date,
  meal        text,                              -- breakfast/lunch/dinner/snack
  description text,                              -- recipe title or "ate out: ramen"
  calories    integer,
  source      text,                              -- "recipe" / "photo"
  recipe_id   uuid references recipes(id),       -- nullable
  created_at  timestamptz not null default now()
);

-- meal plan (optional for MVP; the plan structure is just jsonb)
create table meal_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default 'demo',
  week_start date not null,
  plan       jsonb not null default '[]',        -- [{day, meal, recipe_id}, ...]
  created_at timestamptz not null default now()
);

-- shopping list (optional; can also be derived on the fly)
create table shopping_list_items (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null default 'demo',
  name       text not null,
  quantity   numeric,
  unit       text,
  checked    boolean not null default false,
  created_at timestamptz not null default now()
);
```

### IMPORTANT — Supabase Row Level Security (this trips up everyone)

Supabase enables RLS on new tables and blocks ALL reads/writes until you add a policy,
so your app will mysteriously return empty data. For this hackathon we skip auth and
use a single `'demo'` user, so just disable RLS on all tables:

```sql
alter table inventory_items      disable row level security;
alter table recipes              disable row level security;
alter table diet_log             disable row level security;
alter table meal_plans           disable row level security;
alter table shopping_list_items  disable row level security;
```

This is a hackathon shortcut only (the anon key gets full access). Fine for a demo,
not for production. No real auth for MVP — everything uses `user_id = 'demo'`.

### Seed data (do right after creating tables)

Insert ~6 recipes and ~10 inventory items by hand (or have Claude Code generate the
INSERT statements). Reasons this matters:
- It lets us build and test `inventory → recipe → record` **without** receipt scanning
  or video extraction working yet (mock the boundaries).
- The same seed data is our **demo safety net** — never gamble the live demo on
  real-time OCR or scraping succeeding on stage.

---

## Build order (build the spine first, then add inputs)

**Phase 0 — foundation (first ~2h)**
- Scaffold Next.js + TS + Tailwind, install `@supabase/supabase-js` and `@anthropic-ai/sdk`.
- Create the Supabase tables (above) + seed data.
- Deploy the empty shell to Vercel now, to de-risk deployment early.

**Phase 1 — spine with seed data (~6h)**
- Inventory page: list items sorted by `expiry_date` ascending.
- Recipe generation: read inventory + saved recipes, produce a plan that prioritizes
  soon-to-expire items and prefers `source_type != 'seed'`-style saved recipes; use
  Claude to fill gaps. (Prioritization logic = the soul; build it here, not later.)
- Record page: log a meal to `diet_log`.

**Phase 2 — close the loop (~6h)**
- Cooking a recipe deducts matching ingredients from `inventory_items` + writes calories
  to `diet_log`.
- Generate `shopping_list_items` = planned recipe ingredients minus current inventory.

**Phase 3 — real inputs (~4h)**
- Receipt → inventory: send the photo to Claude (vision), get back JSON
  `[{name, quantity, unit, category, estimated_shelf_life_days}]`, compute `expiry_date`,
  insert rows.
- Eat-out photo → calories: send photo to Claude, get an estimate, log it.
- (Stretch) YouTube → recipe: see Sponsor Integrations.

**Phase 4 — polish + demo prep (last ~4–6h)**
- UI polish (there's a Best UI/UX prize).
- (Stretch) Redis recipe memory.
- Make the Devpost draft (before Saturday midnight!), rehearse a 4-min pitch, record a
  backup demo video.

---

## Sponsor integrations (priority order)

1. **Claude (required)** — used everywhere. When you ask Claude for structured data,
   tell it to return *only* valid JSON, then `JSON.parse` and insert. The `ingredients`
   and `steps` jsonb columns take Claude's nested JSON almost as-is.
2. **Redis (stretch)** — store each recipe's text + an embedding; semantic search
   "what can I make with X". Only after Phase 2 works. Qualifies for the Redis prize.
3. **Browserbase + Stagehand (stretch)** — recipe extraction from a YouTube URL.
   Browserbase does NOT watch the video; it opens the page and scrapes the **transcript
   / captions + description + top comments**, then Claude structures that text into a
   recipe. Default scope = **YouTube only**. Xiaohongshu (小红书) is optional and risky
   (anti-bot / login walls) — only attempt if everything else is done. Pre-extract a
   couple recipes before the demo; don't scrape live on stage. Qualifies for the
   Browserbase prize. Get exact Stagehand API from the Browserbase workshop / docs.

---

## Conventions & how to work in this repo

- **One feature at a time.** Describe a single feature, review the diff, test it in the
  browser, commit, then move on. Don't ask for ten things at once.
- **Commit often** with clear messages.
- **Suggested folder layout**:
  - `app/` — pages (inventory, recipes, log, shopping) + `app/api/*` route handlers.
  - `lib/supabase.ts` — Supabase client.
  - `lib/claude.ts` — Claude API helpers (one function per task, each returns parsed JSON).
  - `lib/types.ts` — shared TS types matching the DB tables.
- **All Claude calls go through `lib/claude.ts`**, not scattered in components.
- Keep it simple: prefer jsonb over new tables; don't add libraries we don't need.

### Team git workflow (4 people, one repo)

- Each person works on their own branch: `feature/inventory`, `feature/recipes`,
  `feature/record`, `feature/setup-deploy`.
- Do not let two people edit the same files at once — split by the folders above.
- Merge small, working changes back to `main` frequently. Don't hoard a giant branch.

---

## Current task

Set up the database: run the schema SQL in Supabase, disable RLS, insert seed data,
and create `lib/supabase.ts` + `lib/types.ts` that match these tables. Then we move to
Phase 1.
