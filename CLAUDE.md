# CLAUDE.md — Browserbase-First Waste-Aware Meal Planning Agent

> Working title, rename freely. This file is the project's shared brain — Claude Code
> reads it every session. Keep it accurate; if a decision changes, update this file.
>
> Current sponsor strategy: **primary target = Best Use of Browserbase**. Browserbase is
> not a small scraping stretch feature. It is the web-action layer of the product.

## What we're building

A Browserbase-powered meal-planning agent that ties together four things normal apps
keep separate:

**inventory + trusted recipes + web context + calorie / shopping loop**.

The differentiator is the *loop*, not any single feature.

Core loop:
`inventory → trusted recipe import → meal plan → record → shopping list → (back to inventory)`

1. **Inventory** — user photographs a grocery receipt; we extract items + estimate
   shelf life; items are sorted by how soon they expire.
2. **Trusted recipe import** — user pastes a YouTube / recipe blog / saved link.
   Browserbase browses the real page, extracts recipe context, and Claude structures it
   into ingredients + cooking cards. We prefer recipes the user saved over random
   AI-generated recipes.
3. **Meal planning** — we suggest a meal plan that *prioritizes soon-to-expire
   ingredients* and *prefers saved/imported recipes* over generated ones. This
   prioritization logic is the soul of the product — do not treat it as an afterthought.
4. **Record** — cooking a recipe auto-deducts inventory + logs calories; eating out =
   photograph the food, estimate calories, log it.
5. **Shopping list** — next week's plan minus current inventory = what to buy. Browserbase
   can optionally search grocery sites for price / availability, but the MVP must not
   auto-checkout or make purchases.

One-liner:

> **Turn the groceries you already have and the recipes you already trust into actionable,
> low-waste meals.**

Browserbase-first one-liner:

> **A Browserbase-powered food web agent that imports recipes from the messy web,
> plans around what expires first, and turns missing ingredients into a smart shopping list.**

Hackathon track: **Ddoski's World (social impact)**.
Sponsor prize target: **Best Use of Browserbase**.

---

## Browserbase strategy — core product thesis

Browserbase is the project's web operating layer. Do not describe it as “scraping.”
Describe it as **browser-native agent infrastructure**:

> Food information is scattered across YouTube, recipe blogs, grocery websites, and
> nutrition pages. Most of those sources do not expose clean APIs. Browserbase lets our
> agent use the web like a human: search, fetch, browse, click, scroll, extract, persist
> sessions, and replay what happened.

### Browserbase design principles

1. **Use Browserbase when the task touches the web.**
   - Recipe URL import → Browserbase.
   - YouTube recipe import → Browserbase.
   - Grocery lookup → Browserbase.
   - Nutrition verification → Browserbase.
   - Any overlap with generic scraping / manual copy-paste should be implemented through
     Browserbase first.
2. **Escalation pattern:**
   - First use **Search API** to find relevant pages when no URL is provided.
   - Then use **Fetch API** for cheap read-only extraction from simple pages.
   - If the page needs JavaScript, scrolling, clicking, transcript expansion, login, or
     popup handling, escalate to a **Browser Session + Stagehand**.
3. **Use Stagehand primitives intentionally.**
   - `observe()` to find buttons / transcript / search boxes / recipe cards.
   - `act()` to click, type, scroll, close popups, expand descriptions.
   - `extract()` to produce structured JSON using a schema.
   - `agent()` only for messy multi-step exploration. For critical demo paths, prefer
     explicit `observe → act → extract` so behavior is explainable.
4. **Make Browserbase visible in the UI.**
   Every web import should display a Browserbase run panel: session id, mode, action log,
   extracted JSON, confidence, Live View / Replay link when available.
5. **Human-in-the-loop for sensitive actions.**
   Browserbase may prepare shopping lists or cart previews. It must not purchase,
   checkout, submit payment, delete inventory, or modify external accounts without
   explicit user confirmation.

---

## Tech stack (locked — do not add more without a reason)

- **Next.js (App Router) + TypeScript + Tailwind CSS** — frontend + backend API routes
  in one app.
- **Supabase (Postgres)** — data storage. Use the `@supabase/supabase-js` client.
- **Anthropic Claude API** — all reasoning / structuring work: receipt vision, recipe
  normalization, meal planning, calorie estimates, and cleaning Browserbase-extracted
  text. Model string: `claude-sonnet-4-6` unless the workshop gives a different required
  model.
- **Browserbase + Stagehand** — core web-agent layer: Search API, Fetch API, Browser
  Sessions, Stagehand `observe/act/extract/agent`, Contexts, Live View, Session Replay,
  and optionally Functions.
- **Vercel** — deployment.

Stretch only after the Browserbase-first loop works:

- **Redis** — recipe memory / vector search. Useful, but do not prioritize over
  Browserbase because the primary sponsor target is Browserbase.
- **Deepgram / ElevenLabs** — voice cooking mode. Nice demo, but only after the
  Browserbase import loop is stable.

Do **not** add generic scraping frameworks, browser-use alternatives, or separate crawler
vendors unless Browserbase cannot handle a specific task and the team explicitly agrees.
If functionality overlaps, use Browserbase.

---

## Environment variables (`.env.local`)

```bash
ANTHROPIC_API_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Browserbase core
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Optional but useful if the workshop/docs expose them clearly
BROWSERBASE_CONTEXT_ID=...          # reuse login/session state for YouTube/grocery sites
BROWSERBASE_FUNCTION_URL=...        # if recipe import is deployed as a Browserbase Function

# stretch only:
REDIS_URL=...
```

Never commit `.env.local`. Make sure it is in `.gitignore`.

---

## DATABASE — do this first

Run the following in the Supabase **SQL Editor** (Dashboard → SQL Editor → New query).
This schema includes Browserbase metadata so the UI can show exactly how each recipe or
web lookup was imported.

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
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null default 'demo',
  title                    text not null,
  ingredients              jsonb not null default '[]',   -- [{name, qty, unit}, ...]
  steps                    jsonb not null default '[]',   -- [{step, instruction, timeMinutes}, ...]
  calories_per_serving     integer,
  servings                 integer default 1,
  tags                     jsonb default '[]',            -- ["quick","high-protein"]
  source_type              text default 'seed',           -- seed/manual/youtube/web_recipe/xiaohongshu
  source_url               text,

  -- Browserbase import metadata. Keep this even if null for seed/manual recipes.
  browserbase_session_id   text,
  browserbase_replay_url   text,
  browserbase_live_url     text,
  extraction_mode          text,                          -- fetch/session/stagehand/function/manual
  extraction_confidence    numeric,
  source_metadata          jsonb default '{}',            -- author, channel, page title, duration, etc.

  created_at               timestamptz not null default now()
);

-- web imports: one row per Browserbase run, even if it fails.
-- This powers the Browserbase Web Agent Console in the UI.
create table web_imports (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null default 'demo',
  input_url                text,
  input_query              text,
  import_type              text not null,                  -- recipe_url/youtube/grocery_lookup/nutrition_lookup
  status                   text not null default 'pending', -- pending/running/succeeded/failed
  browserbase_session_id   text,
  browserbase_replay_url   text,
  browserbase_live_url     text,
  extraction_mode          text,                           -- search/fetch/session/stagehand/function
  action_log               jsonb not null default '[]',    -- [{step, action, result}]
  extracted_json           jsonb default '{}',
  error_message            text,
  created_at               timestamptz not null default now(),
  completed_at             timestamptz
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
  plan       jsonb not null default '[]',        -- [{day, meal, recipe_id, reason}, ...]
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

  -- Optional Browserbase grocery lookup metadata
  source_url text,
  store      text,
  price      text,
  available  boolean,

  created_at timestamptz not null default now()
);
```

### Migration if the old schema already exists

If the original non-Browserbase schema was already created, run this instead of dropping
data:

```sql
alter table recipes add column if not exists browserbase_session_id text;
alter table recipes add column if not exists browserbase_replay_url text;
alter table recipes add column if not exists browserbase_live_url text;
alter table recipes add column if not exists extraction_mode text;
alter table recipes add column if not exists extraction_confidence numeric;
alter table recipes add column if not exists source_metadata jsonb default '{}';

alter table shopping_list_items add column if not exists source_url text;
alter table shopping_list_items add column if not exists store text;
alter table shopping_list_items add column if not exists price text;
alter table shopping_list_items add column if not exists available boolean;

create table if not exists web_imports (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  text not null default 'demo',
  input_url                text,
  input_query              text,
  import_type              text not null,
  status                   text not null default 'pending',
  browserbase_session_id   text,
  browserbase_replay_url   text,
  browserbase_live_url     text,
  extraction_mode          text,
  action_log               jsonb not null default '[]',
  extracted_json           jsonb default '{}',
  error_message            text,
  created_at               timestamptz not null default now(),
  completed_at             timestamptz
);
```

### IMPORTANT — Supabase Row Level Security (this trips up everyone)

Supabase enables RLS on new tables and blocks ALL reads/writes until you add a policy,
so your app will mysteriously return empty data. For this hackathon we skip auth and
use a single `'demo'` user, so just disable RLS on all tables:

```sql
alter table inventory_items      disable row level security;
alter table recipes              disable row level security;
alter table web_imports          disable row level security;
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
  or Browserbase extraction working yet.
- The same seed data is our **demo safety net** — never gamble the live demo on one live
  web import succeeding on stage.
- Add 2–3 imported-looking recipes with `source_type = 'youtube'` or `source_type =
  'web_recipe'` and filled `source_url` so the meal planner already prefers trusted
  saved/imported recipes.

---

## Build order — Browserbase-first

Build the spine first, then add Browserbase web actions. Do not start with five external
APIs at once.

**Phase 0 — foundation (first ~2h)**

- Scaffold Next.js + TS + Tailwind.
- Install core libraries:
  - `@supabase/supabase-js`
  - `@anthropic-ai/sdk`
  - Browserbase SDK / Stagehand package from the current Browserbase workshop/docs.
- Create the Supabase tables (above) + seed data.
- Deploy the empty shell to Vercel now, to de-risk deployment early.

**Phase 1 — spine with seed data (~4–6h)**

- Inventory page: list items sorted by `expiry_date` ascending.
- Recipe page: list seeded + saved recipes, clearly labeling `source_type`.
- Meal planner: read inventory + saved recipes, produce a plan that prioritizes
  soon-to-expire items and prefers `source_type != 'seed'` saved/imported recipes; use
  Claude only to fill gaps.
- Record page: log a meal to `diet_log`.

**Phase 2 — Browserbase recipe import (~6–8h, sponsor-critical)**

- Build `/import` page where user pastes a recipe URL or YouTube URL.
- Implement `app/api/browserbase/import-recipe/route.ts`.
- Add `lib/browserbase.ts` with one high-level function:
  `importRecipeWithBrowserbase(inputUrl: string)`.
- Implement the escalation path:
  1. Try Browserbase Fetch for simple read-only page extraction.
  2. If extraction is weak / page is JS-heavy / YouTube / needs clicks, launch a
     Browserbase Session with Stagehand.
  3. Use Stagehand `observe → act → extract` for transcript / description / recipe card.
  4. Send extracted raw text/JSON to Claude for final recipe normalization.
  5. Insert recipe into `recipes` and the run into `web_imports`.
- UI must show a **Browserbase Web Agent Console** for each run.

**Phase 3 — close the loop (~4–6h)**

- Cooking a recipe deducts matching ingredients from `inventory_items` + writes calories
  to `diet_log`.
- Generate `shopping_list_items` = planned recipe ingredients minus current inventory.
- Add “why this meal?” explanation: expiring ingredients used, saved recipe matched,
  calories, cooking time.

**Phase 4 — Browserbase grocery / nutrition workflows (~4–6h)**

- `lookupGroceryItems(shoppingList)`:
  - Use Browserbase Search API to find product pages if no store URL is configured.
  - Use Fetch for simple product pages.
  - Use Session + Stagehand for search boxes, dynamic pages, popups.
  - Extract product name, price, size, availability, source URL.
- `verifyNutrition(recipe)`:
  - Use Search + Fetch to retrieve nutrition facts for major ingredients.
  - Attach source/confidence to the recipe or meal-plan explanation.
- No automatic checkout.

**Phase 5 — polish + demo prep (last ~4–6h)**

- UI polish; there may be a Best UI/UX prize.
- Add replay links / action logs to the demo UI.
- Prepare 2–3 backup imported recipes in the DB.
- Record a backup demo video.
- Rehearse the Browserbase-specific pitch.

---

## Browserbase implementation details

### Folder layout additions

```text
app/
  import/page.tsx                         # paste URL, show import status + recipe cards
  api/
    browserbase/
      import-recipe/route.ts              # URL/YouTube -> structured recipe
      grocery-lookup/route.ts             # shopping list -> product options
      nutrition-verify/route.ts           # recipe/ingredient -> nutrition sources
components/
  BrowserbaseRunPanel.tsx                 # session id, action log, replay/live links
  RecipeCards.tsx                         # flip-card / step-by-step cooking mode
lib/
  browserbase.ts                          # all Browserbase calls live here
  claude.ts                               # all Claude calls live here
  supabase.ts
  types.ts
```

### Browserbase helper contract

Keep all Browserbase work inside `lib/browserbase.ts`. Components and route handlers
should not directly call Browserbase SDK methods.

```ts
export type BrowserbaseImportResult = {
  status: "succeeded" | "failed";
  inputUrl: string;
  importType: "recipe_url" | "youtube" | "grocery_lookup" | "nutrition_lookup";
  extractionMode: "search" | "fetch" | "session" | "stagehand" | "function" | "manual";
  browserbaseSessionId?: string;
  browserbaseReplayUrl?: string;
  browserbaseLiveUrl?: string;
  actionLog: Array<{ step: number; action: string; result: string }>;
  extractedJson?: unknown;
  rawText?: string;
  errorMessage?: string;
};
```

### Workflow A — recipe blog URL → structured recipe

Use for recipe websites, blog posts, and pages that already contain a written recipe.

1. Create a `web_imports` row with `status = 'running'`.
2. Try Browserbase Fetch.
3. Ask Browserbase/Claude to produce candidate markdown / JSON.
4. If missing ingredients/steps/title, escalate to Browserbase Session + Stagehand.
5. Stagehand:
   - `observe("find the recipe card, jump-to-recipe button, ingredients, and instructions")`
   - `act("click Jump to Recipe if present")`
   - `extract({ schema: RecipeCandidateSchema })`
6. Claude normalizes to final recipe JSON.
7. Insert into `recipes` with Browserbase metadata.
8. Mark `web_imports.status = 'succeeded'`.

### Workflow B — YouTube cooking video → recipe cards

Browserbase does not “watch” the video. It uses the actual webpage to extract available
textual context:

- title
- description
- chapters / timestamps if visible
- transcript / captions if available
- pinned comment / top useful comments if accessible

Flow:

1. Open YouTube URL in Browserbase Session.
2. Use Stagehand `observe()` to find buttons/regions: description, “more”, transcript,
   chapters, comments.
3. Use `act()` to expand description / transcript.
4. Use `extract()` to collect structured text.
5. Claude turns extracted text into recipe cards:
   - ingredients
   - prep steps
   - cooking steps
   - timing
   - servings
   - tags
   - calories estimate
6. UI shows step-by-step cards. This is the key user insight: users trust recipes they
   saved more than random AI-generated recipes.

### Workflow C — shopping list → grocery lookup

Use after meal planning produces missing ingredients.

1. Input: `shopping_list_items`.
2. For each item, Browserbase Search finds candidate product/store pages.
3. Browserbase Fetch extracts simple product pages.
4. Browser Session + Stagehand handles dynamic grocery search pages.
5. Store price/availability/source URL on `shopping_list_items`.
6. No checkout. No payment. No external account modification.

### Workflow D — calories / nutrition verification

Do not rely only on AI guessing if Browserbase can fetch evidence.

1. Use Browserbase Search to find nutrition facts for major ingredients.
2. Use Fetch to retrieve content.
3. Extract calories/protein/carbs/fat per serving or per 100g when possible.
4. Claude reconciles ingredient quantities with recipe serving count.
5. Meal plan displays calories as “estimated,” with source/confidence.

---

## Browserbase Web Agent Console — required UI

Add a visible panel after each import. This is critical for the Browserbase sponsor judge.

Minimum fields:

```text
Browserbase Web Agent Console
Status: succeeded / failed
Mode: Fetch -> Session -> Stagehand
Session ID: <browserbase_session_id>
Source URL: <url>
Actions:
  1. Opened recipe page
  2. Observed Jump to Recipe button
  3. Clicked Jump to Recipe
  4. Extracted ingredients and steps
  5. Normalized recipe with Claude
Links:
  - Live View, if active
  - Session Replay, if available
  - Extracted JSON
```

The UI must make it obvious that Browserbase is not a hidden backend dependency. The
judge should see the browser session, the extraction steps, and the final structured
recipe.

---

## Sponsor integrations (priority order)

1. **Browserbase + Stagehand (required, primary prize target)**
   - Search API: find recipe, grocery, or nutrition pages.
   - Fetch API: cheap extraction for static/read-only pages.
   - Browser Sessions: real browser interaction for dynamic pages.
   - Stagehand `observe/act/extract/agent`: resilient page interaction and structured
     extraction.
   - Contexts: optional login/session persistence for YouTube or grocery sites.
   - Live View / Session Replay: show auditability and debugging in the product.
   - Functions: optional; deploy recipe import or grocery lookup as a Browserbase-hosted
     function if the core loop is already stable.
2. **Claude (required)**
   - Used for reasoning and normalization after Browserbase obtains web context.
   - When you ask Claude for structured data, tell it to return *only* valid JSON, then
     `JSON.parse` and insert. The `ingredients` and `steps` jsonb columns take Claude's
     nested JSON almost as-is.
3. **Redis (stretch)**
   - Store each recipe's text + embedding; semantic search “what can I make with X?”
   - Only after Browserbase recipe import and core loop work.
4. **Deepgram / ElevenLabs (stretch)**
   - Voice cooking mode: hands-free “next step,” “repeat,” “how much protein?”
   - Only after Browserbase sponsor story is strong.

---

## Demo plan for Best Use of Browserbase

Do not demo five weak integrations. Demo one strong Browserbase-native story.

### 2–4 minute flow

1. **Problem:** “Food waste happens because our groceries, saved recipes, and shopping
   decisions are disconnected.”
2. **Paste a YouTube or recipe URL.**
   - Browserbase opens / fetches / browses the page.
   - Stagehand expands transcript or recipe card.
   - `extract()` produces structured ingredients + steps.
3. **Show Browserbase Web Agent Console.**
   - Session ID.
   - Action log.
   - Replay / Live View link.
   - Extracted JSON.
4. **Meal plan from trusted recipe + inventory.**
   - User says: “busy week, high protein, use expiring spinach and chicken first.”
   - Planner chooses imported recipes before random AI recipes.
5. **Generate shopping list.**
   - Missing ingredients only.
   - Optional Browserbase grocery lookup for one or two items.
6. **End with the Browserbase thesis:**
   - “Every recommendation is traceable back to the web actions and sources that produced
     it.”

### Backup demo rule

Live web imports are impressive but risky. Pre-import 2–3 recipes before demo and keep
their `web_imports` + replay links. During the live demo:

- Try one live Browserbase import.
- If it takes too long, switch to “Here is the same workflow we ran earlier,” and show the
  saved Browserbase run, extracted JSON, recipe cards, and meal plan.

---

## Pitch wording

Use this wording whenever explaining the Browserbase integration:

> **Browserbase is the action layer of PantryPilot. Food information is scattered across
> YouTube, recipe blogs, grocery stores, and nutrition pages. APIs don't exist for most of
> that. Browserbase lets our agent use the web like a human: search, open pages, click
> through dynamic interfaces, extract structured recipe and grocery data, persist sessions,
> and replay every action for transparency.**

More technical version:

> **The key technical idea is escalation: Browserbase Search for discovery, Fetch for cheap
> static extraction, Browser Sessions for dynamic pages, Stagehand primitives for reliable
> interaction, and Session Replay for auditable food recommendations.**

---

## Conventions & how to work in this repo

- **One feature at a time.** Describe a single feature, review the diff, test it in the
  browser, commit, then move on. Don't ask for ten things at once.
- **Commit often** with clear messages.
- **Suggested branch split for 4 people:**
  - `feature/inventory-spine` — Supabase schema, inventory, recipe list, meal plan.
  - `feature/browserbase-import` — Browserbase import page + API route + run panel.
  - `feature/record-shopping` — cooking record, inventory deduction, shopping list.
  - `feature/ui-demo-polish` — recipe cards, Browserbase console, pitch demo states.
- Do not let two people edit the same files at once.
- **All Claude calls go through `lib/claude.ts`**, not scattered in components.
- **All Browserbase calls go through `lib/browserbase.ts`**, not scattered in components.
- Keep it simple: prefer jsonb over new tables; don't add libraries we don't need.
- Do not use Browserbase to bypass paywalls, scrape private data, or perform purchases.

---

## Current task

Set up the database and the Browserbase-first skeleton:

1. Run the schema SQL in Supabase or the migration SQL if the old schema already exists.
2. Disable RLS.
3. Insert seed inventory + seed/imported-looking recipes.
4. Create:
   - `lib/supabase.ts`
   - `lib/types.ts`
   - `lib/claude.ts`
   - `lib/browserbase.ts`
5. Build the Phase 1 spine first.
6. Then implement `/import` + `app/api/browserbase/import-recipe/route.ts` as the first
   Browserbase sponsor-critical feature.
