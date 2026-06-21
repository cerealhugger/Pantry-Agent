import type { Ingredient, NutritionEvidence } from "./types";

const SKIP_INGREDIENTS = [
  "water",
  "salt",
  "black pepper",
  "ground black pepper",
  "salt and pepper",
  "ice",
];

export function selectMajorNutritionIngredients(ingredients: Ingredient[]): string[] {
  const configuredLimit = Number(process.env.NUTRITION_MAX_INGREDIENTS);
  const limit = Number.isFinite(configuredLimit)
    ? Math.min(8, Math.max(1, Math.floor(configuredLimit)))
    : 4;
  const names = ingredients
    .map((ingredient) => ingredient.name?.trim())
    .filter((name): name is string => Boolean(name))
    .filter((name) => {
      const lower = name.toLowerCase();
      return !SKIP_INGREDIENTS.includes(lower) && !/^water\b/.test(lower);
    });

  return [...new Set(names.map((name) => name.toLowerCase()))].slice(0, limit);
}

export function capConfidenceByEvidence(
  requested: "high" | "medium" | "low",
  evidence: NutritionEvidence[],
  fallbackIngredientCount = 0,
): "high" | "medium" | "low" {
  const verified = evidence.filter((item) => item.status === "verified");
  const coverageDenominator = evidence.length + fallbackIngredientCount;
  const coverage = coverageDenominator > 0 ? verified.length / coverageDenominator : 0;
  const evidenceCeiling =
    coverage >= 0.75 && verified.some((item) => item.confidence === "high")
      ? "high"
      : coverage >= 0.4
        ? "medium"
        : "low";
  const rank = { low: 0, medium: 1, high: 2 } as const;
  return rank[requested] <= rank[evidenceCeiling] ? requested : evidenceCeiling;
}

export function nutritionEstimationMethod(
  evidence: NutritionEvidence[],
  fallbackIngredientCount = 0,
): "browser_evidence" | "hybrid" | "ai_fallback" {
  const verifiedCount = evidence.filter((item) => item.status === "verified").length;
  if (verifiedCount === 0) return "ai_fallback";
  if (verifiedCount < evidence.length || fallbackIngredientCount > 0) return "hybrid";
  return "browser_evidence";
}
