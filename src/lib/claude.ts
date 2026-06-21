import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Ingredient, NutritionEvidence } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NormalizedRecipe = {
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  calories_per_serving: number | null;
  servings: number;
  tags: string[];
};

export async function normalizeRecipe(rawText: string): Promise<NormalizedRecipe> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a recipe normalizer. Extract a structured recipe from the text below.

Return ONLY valid JSON — no markdown, no explanation.

Schema:
{
  "title": string,
  "ingredients": [{"name": string, "qty": number | null, "unit": string | null}],
  "steps": [string],
  "calories_per_serving": number | null,
  "servings": number,
  "tags": [string]
}

Raw text:
${rawText}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON");
  const result = JSON.parse(match[0]) as NormalizedRecipe;
  if (!result.title || result.title === "Unknown" || result.ingredients.length === 0) {
    throw new Error("Claude could not find a recipe in the extracted content");
  }
  return result;
}

// ─── Workflow D — reconcile browser-extracted nutrition into per-serving calories ─

export type NutritionReconciliation = {
  estimated_calories_per_serving: number | null;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  browserEvidenceIngredientCount: number;
  fallbackIngredientCount: number;
};

const ingredientEstimateSchema = z.object({
  ingredient: z.string().trim().min(1),
  estimated_weight_g: z.number().finite().positive().max(100_000).nullable(),
  matched_evidence_ingredient: z.string().trim().min(1).nullable(),
  fallback_calories_per_100g: z.number().finite().nonnegative().max(1_000).nullable(),
});

const nutritionEstimateSchema = z.object({
  ingredient_estimates: z.array(ingredientEstimateSchema),
  confidence: z.enum(["high", "medium", "low"]),
});

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export async function reconcileRecipeNutrition(input: {
  title: string;
  servings: number | null;
  ingredients: Ingredient[];
  evidence: NutritionEvidence[];
}): Promise<NutritionReconciliation> {
  const servings = input.servings && input.servings > 0 ? input.servings : 1;

  // Compact view of the browser evidence so the model can map it to ingredients.
  const evidenceLines = input.evidence
    .filter((e) => e.status === "verified" && e.per100g?.calories != null)
    .map(
      (e) =>
        `- ${e.ingredient}: ${e.per100g!.calories} kcal / 100g` +
        ` (protein ${e.per100g!.protein_g ?? "?"}g, carbs ${e.per100g!.carbs_g ?? "?"}g, fat ${e.per100g!.fat_g ?? "?"}g)` +
        ` [source: ${e.sourceUrl ?? "n/a"}]`,
    )
    .join("\n");

  const ingredientLines = input.ingredients
    .map((i) => `- ${i.raw ?? `${i.qty ?? ""} ${i.unit ?? ""} ${i.name}`.trim()}`)
    .join("\n");

  const prompt = `You map recipe quantities to browser-extracted nutrition evidence.

Recipe: ${input.title}
Servings: ${servings}

Ingredients (verbatim lines):
${ingredientLines || "(none)"}

Browser-extracted per-100g nutrition evidence:
${evidenceLines || "(no verified evidence — rely on general knowledge)"}

Task:
1. For every recipe ingredient, estimate its edible weight in grams from the recipe line.
2. If browser evidence covers it, copy the exact evidence ingredient name into
   matched_evidence_ingredient and set fallback_calories_per_100g to null.
3. If no evidence covers it, set matched_evidence_ingredient to null and estimate
   fallback_calories_per_100g from general nutrition knowledge.
4. Do not calculate ingredient calories or a recipe total. The application performs
   all multiplication and addition deterministically.
5. Set confidence "high" if most calorie-significant ingredients are covered by
   evidence, "medium" if some are, "low" if you mostly guessed.

Return ONLY valid JSON — no markdown, no explanation:
{
  "ingredient_estimates": [
    {
      "ingredient": "<recipe ingredient name>",
      "estimated_weight_g": number | null,
      "matched_evidence_ingredient": "<exact evidence ingredient name>" | null,
      "fallback_calories_per_100g": number | null
    }
  ],
  "confidence": "high" | "medium" | "low"
}`;

  let parsed: z.infer<typeof nutritionEstimateSchema> | null = null;
  let lastError: unknown;
  for (const maxTokens of [4_096, 8_192]) {
    try {
      const message = await client.messages.parse({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: zodOutputFormat(nutritionEstimateSchema),
        },
      });
      parsed = message.parsed_output;
      if (parsed) break;
      lastError = new Error("Claude returned no parsed nutrition estimate");
    } catch (error) {
      lastError = error;
    }
  }
  if (!parsed) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Claude did not return valid structured nutrition estimates");
  }

  const evidenceByName = new Map(
    input.evidence
      .filter((item) => item.status === "verified" && item.per100g?.calories != null)
      .map((item) => [normalizedName(item.ingredient), item]),
  );
  let browserEvidenceCount = 0;
  let fallbackCount = 0;
  let totalCalories = 0;
  let calculatedCount = 0;
  const recipeIngredientNames = new Set(
    input.ingredients.map((ingredient) => normalizedName(ingredient.name)),
  );
  const processedIngredients = new Set<string>();

  for (const estimate of parsed.ingredient_estimates) {
    if (estimate.estimated_weight_g == null) continue;
    const directName = normalizedName(estimate.ingredient);
    if (!recipeIngredientNames.has(directName) || processedIngredients.has(directName)) continue;
    processedIngredients.add(directName);

    // Evidence entries keep the exact ingredient names used in the recipe search.
    // Match on that name rather than trusting a model-selected cross-ingredient mapping.
    const browserEvidence = evidenceByName.get(directName);
    const caloriesPer100g =
      browserEvidence?.per100g?.calories ?? estimate.fallback_calories_per_100g;
    if (caloriesPer100g == null) continue;

    totalCalories += (estimate.estimated_weight_g / 100) * caloriesPer100g;
    calculatedCount += 1;
    if (browserEvidence) browserEvidenceCount += 1;
    else fallbackCount += 1;
  }

  const estimatedCaloriesPerServing =
    calculatedCount > 0 ? Math.round(totalCalories / servings) : null;
  const reasoning =
    estimatedCaloriesPerServing == null
      ? "Not enough quantity information to calculate a per-serving estimate."
      : `Programmatic total from estimated ingredient weights: ${Math.round(totalCalories)} kcal across ${servings} serving${servings === 1 ? "" : "s"}. Browser-extracted per-100g facts covered ${browserEvidenceCount} calculated ingredient${browserEvidenceCount === 1 ? "" : "s"}${fallbackCount > 0 ? `; ${fallbackCount} used general nutrition fallback values` : ""}.`;

  return {
    estimated_calories_per_serving: estimatedCaloriesPerServing,
    confidence: parsed.confidence,
    reasoning,
    browserEvidenceIngredientCount: browserEvidenceCount,
    fallbackIngredientCount: fallbackCount,
  };
}
