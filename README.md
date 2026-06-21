# Pantry-Agent

## Recipe blog import

Copy `.env.example` to `.env.local`, set `BROWSERBASE_API_KEY`, then run:

```bash
npm run dev
```

Open `http://localhost:3000/import` or call the API directly:

```bash
curl -X POST http://localhost:3000/api/browserbase/import-recipe \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/recipe"}'
```

The importer uses Browserbase Fetch first. If the result is incomplete, it escalates to
a Browserbase Session with Stagehand to handle popups, recipe jump links, collapsed
content, and lazy loading before returning the `RecipeDraft` shape from `src/lib/types.ts`.
If the imported page has no calories, the same request automatically runs Browserbase
nutrition Search + Fetch and returns an evidence-backed per-serving estimate.

## Nutrition facts verification

Apply `supabase/migrations/20260620170000_nutrition_verification.sql`, then open the meal
planner. Planned recipe cards can verify nutrition individually or as a batch. The server
uses Browserbase Search to discover nutrition pages, Browserbase Fetch to extract calories,
protein, carbs, and fat per 100g, and Claude to reconcile ingredient quantities into an
estimated per-serving calorie value. Each card keeps the source links, confidence, and the
browser-extracted evidence alongside the estimate.

The endpoint can also be called directly:

```bash
curl -X POST http://localhost:3000/api/browserbase/nutrition-verify \
  -H "Content-Type: application/json" \
  -d '{"recipe_id":"<recipe uuid>"}'
```
