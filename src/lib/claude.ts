import Anthropic from "@anthropic-ai/sdk";
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
};

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

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You estimate the calories of a recipe using browser-extracted nutrition evidence.

Recipe: ${input.title}
Servings: ${servings}

Ingredients (verbatim lines):
${ingredientLines || "(none)"}

Browser-extracted per-100g nutrition evidence:
${evidenceLines || "(no verified evidence — rely on general knowledge)"}

Task:
1. For each ingredient, estimate its weight in grams from the recipe line.
2. Multiply by the per-100g calories from the evidence above when the ingredient
   is covered; otherwise use general nutrition knowledge.
3. Sum total calories, then divide by ${servings} servings.
4. Set confidence "high" if most calorie-significant ingredients are covered by
   evidence, "medium" if some are, "low" if you mostly guessed.

Return ONLY valid JSON — no markdown, no explanation:
{
  "estimated_calories_per_serving": number | null,
  "confidence": "high" | "medium" | "low",
  "reasoning": string
}`,
      },
    ],
  });

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON for nutrition reconciliation");
  const parsed = JSON.parse(match[0]) as NutritionReconciliation;
  return {
    estimated_calories_per_serving:
      typeof parsed.estimated_calories_per_serving === "number"
        ? Math.round(parsed.estimated_calories_per_serving)
        : null,
    confidence:
      parsed.confidence === "high" || parsed.confidence === "low"
        ? parsed.confidence
        : "medium",
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}
