import "server-only";

import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  BrowserbaseActionLogEntry,
  BrowserbaseImportResult,
  NutritionEvidence,
  NutritionPer100g,
  RecipeDraft,
} from "./types";

const ingredientSchema = z.object({
  name: z.string().trim().min(1),
  qty: z.number().finite().nonnegative().nullable(),
  unit: z.string().trim().min(1).nullable(),
  raw: z.string().trim().min(1).nullable(),
});

const recipeCandidateSchema = z.object({
  title: z.string().trim(),
  ingredients: z.array(ingredientSchema),
  steps: z.array(z.string().trim().min(1)),
  calories_per_serving: z.number().finite().nonnegative().nullable(),
  servings: z.number().finite().positive().nullable(),
  tags: z.array(z.string().trim().min(1)),
});

const recipeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          qty: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          raw: { type: ["string", "null"] },
        },
        required: ["name", "qty", "unit", "raw"],
      },
    },
    steps: { type: "array", items: { type: "string" } },
    calories_per_serving: { type: ["number", "null"] },
    servings: { type: ["number", "null"] },
    tags: { type: "array", items: { type: "string" } },
  },
  required: [
    "title",
    "ingredients",
    "steps",
    "calories_per_serving",
    "servings",
    "tags",
  ],
} as const;

const extractionInstruction = `Extract the written recipe from this recipe blog page.
Return the recipe title, every ingredient, and the ordered cooking instructions.
For each ingredient, copy the ingredient line exactly as written into "raw" (for example
"black pepper to taste" or "2 cups flour"). Then separate its food name from its numeric
quantity and unit. Use null for a quantity or unit that is not stated; phrases like
"to taste", "a pinch", or "as needed" are not units, so leave unit null for those. Do not
invent missing nutrition data. Tags should be short descriptors explicitly supported by
the page.`;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown Browserbase error";
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

export function validateRecipeUrl(input: unknown): string {
  if (typeof input !== "string" || !input.trim()) {
    throw new Error("A recipe URL is required");
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid absolute recipe URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS recipe URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("Recipe URLs cannot contain credentials");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes(":") ||
    isPrivateIpv4(hostname)
  ) {
    throw new Error("Private or local network URLs are not supported");
  }

  return url.toString();
}

function normalizeCandidate(candidate: unknown, sourceUrl: string): RecipeDraft | null {
  const parsed = recipeCandidateSchema.safeParse(candidate);
  if (!parsed.success) return null;

  const value = parsed.data;
  const ingredients = value.ingredients
    .filter((ingredient) => ingredient.name.length > 0)
    .map((ingredient) => ({
      ...ingredient,
      // Keep the verbatim line; backfill from the parts only if the model omitted it.
      raw:
        ingredient.raw ??
        [ingredient.qty ?? "", ingredient.unit ?? "", ingredient.name]
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
    }));
  const steps = value.steps.filter(Boolean);
  if (!value.title || ingredients.length === 0 || steps.length === 0) return null;

  return {
    title: value.title,
    ingredients,
    steps,
    calories_per_serving: value.calories_per_serving,
    servings: value.servings,
    tags: [...new Set(value.tags.map((tag) => tag.toLowerCase()))],
    source_type: "web_recipe",
    source_url: sourceUrl,
  };
}

async function actOnFirstMatch(
  stagehand: Stagehand,
  instruction: string,
  action: string,
  addLog: (action: string, result: string) => void,
): Promise<boolean> {
  try {
    const matches = await stagehand.observe(instruction, { timeout: 15_000 });
    if (!matches[0]) {
      addLog(action, "No matching control found");
      return false;
    }

    const result = await stagehand.act(matches[0], { timeout: 15_000 });
    addLog(action, result.success ? result.message : `Skipped: ${result.message}`);
    return result.success;
  } catch (error) {
    addLog(action, `Skipped: ${errorMessage(error)}`);
    return false;
  }
}

export async function importRecipeWithBrowserbase(input: unknown): Promise<BrowserbaseImportResult> {
  const inputUrl = validateRecipeUrl(input);
  const actionLog: BrowserbaseActionLogEntry[] = [];
  const addLog = (action: string, result: string) => {
    actionLog.push({ step: actionLog.length + 1, action, result });
  };

  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return {
      status: "failed",
      inputUrl,
      importType: "recipe_url",
      extractionMode: "fetch",
      actionLog,
      errorMessage: "BROWSERBASE_API_KEY is not configured",
    };
  }

  const browserbase = new Browserbase({ apiKey });
  try {
    addLog("Browserbase Fetch", "Requesting structured recipe JSON");
    const response = await browserbase.fetchAPI.create({
      url: inputUrl,
      allowRedirects: true,
      format: "json",
      schema: recipeJsonSchema,
    });

    const recipe = normalizeCandidate(response.content, inputUrl);
    if (response.statusCode >= 200 && response.statusCode < 300 && recipe) {
      addLog("Validate Fetch result", "Complete title, ingredients, and steps found");
      return {
        status: "succeeded",
        inputUrl,
        importType: "recipe_url",
        extractionMode: "fetch",
        actionLog,
        recipe,
      };
    }

    addLog(
      "Escalate to Browser Session",
      `Fetch returned status ${response.statusCode} or an incomplete recipe`,
    );
  } catch (error) {
    addLog("Escalate to Browser Session", `Fetch failed: ${errorMessage(error)}`);
  }

  let stagehand: Stagehand | undefined;
  let browserbaseSessionId: string | undefined;
  let browserbaseReplayUrl: string | undefined;
  let browserbaseLiveUrl: string | undefined;

  try {
    stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey,
      model: process.env.STAGEHAND_MODEL || "google/gemini-3-flash-preview",
      domSettleTimeout: 3_000,
      selfHeal: true,
      browserbaseSessionCreateParams: {
        browserSettings: { blockAds: true },
      },
    });
    await stagehand.init();

    browserbaseSessionId = stagehand.browserbaseSessionID;
    browserbaseReplayUrl = stagehand.browserbaseSessionURL;
    browserbaseLiveUrl = stagehand.browserbaseDebugURL;
    addLog("Start Browser Session", browserbaseSessionId || "Session started");

    const page = stagehand.context.pages()[0];
    if (!page) throw new Error("Browserbase session did not open a page");

    await page.goto(inputUrl, { waitUntil: "domcontentloaded", timeoutMs: 45_000 });
    addLog("Open recipe page", "JavaScript-rendered page loaded");

    await actOnFirstMatch(
      stagehand,
      "Find a visible close, dismiss, accept, or reject button for a cookie banner, newsletter popup, or modal that blocks the recipe. Return nothing if no overlay blocks the page.",
      "Handle blocking popup",
      addLog,
    );
    await actOnFirstMatch(
      stagehand,
      "Find the Jump to Recipe, View Recipe, or Skip to Recipe control. Return nothing if it is not present.",
      "Jump to recipe",
      addLog,
    );
    await actOnFirstMatch(
      stagehand,
      "Find a Show More, Read More, Expand, or similar control that reveals hidden recipe ingredients or instructions. Return nothing if recipe content is already expanded.",
      "Expand recipe content",
      addLog,
    );

    let bottomChecks = 0;
    for (let index = 0; index < 20 && bottomChecks < 2; index += 1) {
      const atBottom = await page.evaluate(() => {
        window.scrollBy(0, Math.max(window.innerHeight * 0.9, 600));
        return window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
      });
      await page.waitForTimeout(350);
      bottomChecks = atBottom ? bottomChecks + 1 : 0;
    }
    addLog("Load lazy content", "Scrolled through the recipe page");

    const candidate = await stagehand.extract(
      extractionInstruction,
      recipeCandidateSchema,
      { timeout: 45_000 },
    );
    const recipe = normalizeCandidate(candidate, inputUrl);
    if (!recipe) throw new Error("Stagehand could not find a complete written recipe");

    addLog("Stagehand extract", "Complete structured recipe extracted");
    return {
      status: "succeeded",
      inputUrl,
      importType: "recipe_url",
      extractionMode: "stagehand",
      browserbaseSessionId,
      browserbaseReplayUrl,
      browserbaseLiveUrl,
      actionLog,
      recipe,
    };
  } catch (error) {
    addLog("Import failed", errorMessage(error));
    return {
      status: "failed",
      inputUrl,
      importType: "recipe_url",
      extractionMode: "stagehand",
      browserbaseSessionId,
      browserbaseReplayUrl,
      browserbaseLiveUrl,
      actionLog,
      errorMessage: errorMessage(error),
    };
  } finally {
    await stagehand?.close().catch(() => undefined);
  }
}

// ─── Workflow D — nutrition facts verification ───────────────────────────────
//
// Escalation: Browserbase Search API discovers nutrition-fact pages, then the
// Fetch API extracts per-100g macros as structured JSON. Each ingredient ends
// up with calories/protein/carbs/fat, a source URL, and a confidence score so a
// meal plan can show browser-extracted evidence instead of a pure AI guess.

const nutritionResultSchema = z.object({
  food: z.string().trim().nullable(),
  basis: z.string().trim().nullable(),
  serving_size_g: z.number().finite().positive().nullable(),
  calories: z.number().finite().nonnegative().nullable(),
  protein_g: z.number().finite().nonnegative().nullable(),
  carbs_g: z.number().finite().nonnegative().nullable(),
  fat_g: z.number().finite().nonnegative().nullable(),
});

const nutritionJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    food: {
      type: ["string", "null"],
      description: "The food/ingredient this nutrition panel describes",
    },
    basis: {
      type: ["string", "null"],
      description:
        "The serving basis the numbers below refer to, copied from the page, e.g. 'per 100g', 'per 1 cup (240g)'",
    },
    serving_size_g: {
      type: ["number", "null"],
      description: "The serving size in grams that the numbers refer to, if stated",
    },
    calories: {
      type: ["number", "null"],
      description: "Energy in kcal for the stated serving basis",
    },
    protein_g: { type: ["number", "null"], description: "Protein in grams" },
    carbs_g: {
      type: ["number", "null"],
      description: "Total carbohydrate in grams",
    },
    fat_g: { type: ["number", "null"], description: "Total fat in grams" },
  },
  required: [
    "food",
    "basis",
    "serving_size_g",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
  ],
} as const;

const TRUSTED_NUTRITION_DOMAINS = [
  "usda.gov",
  "nal.usda.gov",
  "fdc.nal.usda.gov",
  "nutritionix.com",
  "fatsecret.com",
  "myfitnesspal.com",
  "nutritionvalue.org",
  "eatthismuch.com",
  "verywellfit.com",
  "self.com",
  "nutritiondata.self.com",
  "calorieking.com",
];

const NUTRITION_CACHE_TTL_MS = 6 * 60 * 60 * 1_000;
const nutritionEvidenceCache = new Map<
  string,
  { evidence: NutritionEvidence; expiresAt: number }
>();

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedNutritionHost(host: string): boolean {
  return TRUSTED_NUTRITION_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
}

// Convert whatever serving basis the page reported into a clean per-100g panel.
function toPer100g(value: z.infer<typeof nutritionResultSchema>): NutritionPer100g | null {
  const basisGrams = value.basis?.match(/(?:^|[\s(])([\d.]+)\s*g(?:\b|\))/i)?.[1];
  const grams =
    /\b100\s*g\b/i.test(value.basis ?? "")
      ? 100
      : value.serving_size_g && value.serving_size_g > 0
        ? value.serving_size_g
        : basisGrams
          ? Number(basisGrams)
          : null;
  if (!grams || value.calories == null) return null;

  const factor = 100 / grams;
  const scale = (n: number | null) =>
    n == null ? null : Math.round(n * factor * 10) / 10;

  const panel = {
    calories: scale(value.calories),
    protein_g: scale(value.protein_g),
    carbs_g: scale(value.carbs_g),
    fat_g: scale(value.fat_g),
  };

  const macros = [panel.protein_g, panel.carbs_g, panel.fat_g].filter(
    (item): item is number => item != null,
  );
  if (
    panel.calories == null ||
    panel.calories > 1_000 ||
    macros.some((item) => item > 100)
  ) {
    return null;
  }

  return panel;
}

function scoreNutritionConfidence(
  host: string,
  per100g: NutritionPer100g,
): "high" | "medium" | "low" {
  const hasCalories = per100g.calories != null;
  const macroCount = [per100g.protein_g, per100g.carbs_g, per100g.fat_g].filter(
    (v) => v != null,
  ).length;
  const trusted = isTrustedNutritionHost(host);

  if (hasCalories && macroCount >= 2 && trusted) return "high";
  if (hasCalories && (macroCount >= 2 || trusted)) return "medium";
  return "low";
}

async function verifyOneIngredient(
  browserbase: Browserbase,
  ingredient: string,
  addLog: (action: string, result: string) => void,
): Promise<NutritionEvidence> {
  const query = `${ingredient} nutrition facts calories protein carbs fat per 100g`;
  const cached = nutritionEvidenceCache.get(ingredient);
  if (cached && cached.expiresAt > Date.now()) {
    addLog(`Nutrition cache: ${ingredient}`, "Reused recent Browserbase evidence");
    return { ...cached.evidence, ingredient };
  }
  if (cached) nutritionEvidenceCache.delete(ingredient);

  let results: { url: string; title: string }[] = [];
  try {
    const search = await browserbase.search.web(
      { query, numResults: 4 },
      { timeout: 12_000, maxRetries: 0 },
    );
    results = (search.results ?? [])
      .filter((r) => /^https?:\/\//i.test(r.url))
      .map((r) => ({ url: r.url, title: r.title }));
    addLog(`Search nutrition: ${ingredient}`, `Found ${results.length} candidate pages`);
  } catch (error) {
    addLog(`Search nutrition: ${ingredient}`, `Search failed: ${errorMessage(error)}`);
    return {
      ingredient,
      status: "not_found",
      per100g: null,
      sourceUrl: null,
      sourceTitle: null,
      confidence: "low",
      extractionMode: "none",
      note: errorMessage(error),
    };
  }

  if (results.length === 0) {
    return {
      ingredient,
      status: "not_found",
      per100g: null,
      sourceUrl: null,
      sourceTitle: null,
      confidence: "low",
      extractionMode: "search",
      note: "No nutrition pages found",
    };
  }

  // Prefer trusted nutrition databases, then fall back to the rest.
  const ordered = [
    ...results.filter((r) => isTrustedNutritionHost(hostOf(r.url))),
    ...results.filter((r) => !isTrustedNutritionHost(hostOf(r.url))),
  ];

  for (const candidate of ordered.slice(0, 2)) {
    const host = hostOf(candidate.url);
    try {
      const response = await browserbase.fetchAPI.create(
        {
          url: candidate.url,
          allowRedirects: true,
          format: "json",
          schema: nutritionJsonSchema,
        },
        { timeout: 12_000, maxRetries: 0 },
      );

      const parsed = nutritionResultSchema.safeParse(response.content);
      if (!parsed.success || response.statusCode < 200 || response.statusCode >= 300) {
        addLog(`Fetch ${host}`, `Skipped: no usable nutrition panel`);
        continue;
      }

      const per100g = toPer100g(parsed.data);
      if (!per100g || per100g.calories == null) {
        addLog(`Fetch ${host}`, `Skipped: serving basis not convertible to 100g`);
        continue;
      }

      const confidence = scoreNutritionConfidence(host, per100g);
      addLog(
        `Fetch ${host}`,
        `Extracted ${per100g.calories} kcal/100g (confidence: ${confidence})`,
      );
      const evidence: NutritionEvidence = {
        ingredient,
        status: "verified",
        per100g,
        extractedFood: parsed.data.food,
        sourceBasis: parsed.data.basis,
        servingSizeG: parsed.data.serving_size_g,
        sourceUrl: candidate.url,
        sourceTitle: candidate.title,
        confidence,
        extractionMode: "search+fetch",
      };
      nutritionEvidenceCache.set(ingredient, {
        evidence,
        expiresAt: Date.now() + NUTRITION_CACHE_TTL_MS,
      });
      return evidence;
    } catch (error) {
      addLog(`Fetch ${host}`, `Skipped: ${errorMessage(error)}`);
    }
  }

  return {
    ingredient,
    status: "not_found",
    per100g: null,
    sourceUrl: ordered[0]?.url ?? null,
    sourceTitle: ordered[0]?.title ?? null,
    confidence: "low",
    extractionMode: "search",
    note: "Found pages but could not extract per-100g facts",
  };
}

export async function verifyIngredientNutrition(ingredients: string[]): Promise<{
  evidence: NutritionEvidence[];
  actionLog: BrowserbaseActionLogEntry[];
  errorMessage?: string;
}> {
  const actionLog: BrowserbaseActionLogEntry[] = [];
  const addLog = (action: string, result: string) => {
    actionLog.push({ step: actionLog.length + 1, action, result });
  };

  const cleaned = [...new Set(ingredients.map((i) => i.trim().toLowerCase()))]
    .filter(Boolean)
    .slice(0, 8); // keep the demo fast and within the function time budget

  if (cleaned.length === 0) {
    return { evidence: [], actionLog, errorMessage: "No ingredients to verify" };
  }

  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return { evidence: [], actionLog, errorMessage: "BROWSERBASE_API_KEY is not configured" };
  }

  const browserbase = new Browserbase({ apiKey });
  const evidence = new Array<NutritionEvidence>(cleaned.length);
  let nextIndex = 0;
  const workerCount = Math.min(4, cleaned.length);
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < cleaned.length) {
        const index = nextIndex;
        nextIndex += 1;
        evidence[index] = await verifyOneIngredient(browserbase, cleaned[index], addLog);
      }
    }),
  );

  return { evidence, actionLog };
}
