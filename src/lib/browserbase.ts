import "server-only";

import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import type {
  BrowserbaseActionLogEntry,
  BrowserbaseImportResult,
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
