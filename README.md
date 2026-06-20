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
