import { NextRequest, NextResponse } from "next/server";
import {
  importRecipeWithBrowserbase,
  validateRecipeUrl,
  verifyIngredientNutrition,
} from "@/lib/browserbase";
import { reconcileRecipeNutrition } from "@/lib/claude";
import {
  capConfidenceByEvidence,
  nutritionEstimationMethod,
  selectMajorNutritionIngredients,
} from "@/lib/nutrition";
import type { BrowserbaseImportResult, SavedNutrition } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

async function estimateMissingCalories(
  result: BrowserbaseImportResult,
): Promise<BrowserbaseImportResult> {
  const recipe = result.recipe;
  if (result.status !== "succeeded" || !recipe || recipe.calories_per_serving != null) {
    return result;
  }

  const addLog = (action: string, message: string) => {
    result.actionLog.push({ step: result.actionLog.length + 1, action, result: message });
  };

  addLog(
    "Calories missing",
    "Recipe page did not provide calories; starting Browserbase nutrition lookup",
  );

  try {
    const majorIngredients = selectMajorNutritionIngredients(recipe.ingredients);
    const verification = await verifyIngredientNutrition(majorIngredients);
    for (const entry of verification.actionLog) {
      addLog(`Nutrition · ${entry.action}`, entry.result);
    }
    if (verification.errorMessage) {
      addLog("Nutrition evidence", verification.errorMessage);
    }

    const reconciliation = await reconcileRecipeNutrition({
      title: recipe.title,
      servings: recipe.servings,
      ingredients: recipe.ingredients,
      evidence: verification.evidence,
    });
    if (reconciliation.estimated_calories_per_serving == null) {
      throw new Error("Not enough ingredient quantity information to estimate calories");
    }

    const confidence = capConfidenceByEvidence(
      reconciliation.confidence,
      verification.evidence,
      reconciliation.fallbackIngredientCount,
    );
    const savedNutrition: SavedNutrition = {
      estimatedCaloriesPerServing: reconciliation.estimated_calories_per_serving,
      confidence,
      estimationMethod: nutritionEstimationMethod(
        verification.evidence,
        reconciliation.fallbackIngredientCount,
      ),
      reasoning: reconciliation.reasoning,
      evidence: verification.evidence,
      verifiedAt: new Date().toISOString(),
    };

    recipe.calories_per_serving = reconciliation.estimated_calories_per_serving;
    recipe.extraction_confidence = { high: 0.9, medium: 0.6, low: 0.3 }[confidence];
    recipe.source_metadata = { ...recipe.source_metadata, nutrition: savedNutrition };
    addLog(
      "Estimate calories",
      `${recipe.calories_per_serving} kcal/serving (${confidence} confidence, ${savedNutrition.estimationMethod})`,
    );
  } catch (error) {
    addLog(
      "Estimate calories",
      `Unavailable: ${error instanceof Error ? error.message : "calorie estimation failed"}`,
    );
  }

  return result;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const url = typeof body === "object" && body !== null && "url" in body
    ? (body as { url?: unknown }).url
    : undefined;

  try {
    validateRecipeUrl(url);
    const imported = await importRecipeWithBrowserbase(url);
    const result = await estimateMissingCalories(imported);
    return NextResponse.json(result, { status: result.status === "succeeded" ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid recipe URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
