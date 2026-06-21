import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyIngredientNutrition } from "@/lib/browserbase";
import { reconcileRecipeNutrition } from "@/lib/claude";
import {
  capConfidenceByEvidence,
  nutritionEstimationMethod,
  selectMajorNutritionIngredients,
} from "@/lib/nutrition";
import type {
  Ingredient,
  NutritionVerificationResult,
  Recipe,
  SavedNutrition,
} from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const recipeId =
    typeof body === "object" && body !== null && "recipe_id" in body
      ? (body as { recipe_id?: unknown }).recipe_id
      : undefined;

  if (typeof recipeId !== "string" || !recipeId) {
    return NextResponse.json({ error: "recipe_id is required" }, { status: 400 });
  }

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", recipeId)
    .eq("user_id", "demo")
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = (recipe.ingredients as Ingredient[]) ?? [];
  const major = selectMajorNutritionIngredients(ingredients);

  // Log one web_imports row per Browserbase run (CLAUDE.md: even if it fails).
  const { data: importRow } = await supabase
    .from("web_imports")
    .insert({
      user_id: "demo",
      input_url: null,
      input_query: `nutrition: ${recipe.title}`,
      import_type: "nutrition_lookup",
      status: "running",
      browserbase_session_id: null,
      browserbase_replay_url: null,
      browserbase_live_url: null,
      extraction_mode: "search+fetch",
      action_log: [],
      extracted_json: {},
      error_message: null,
      completed_at: null,
    })
    .select("id")
    .single();

  let evidence: NutritionVerificationResult["evidence"] = [];
  let actionLog: NutritionVerificationResult["actionLog"] = [];

  try {
    const verification = await verifyIngredientNutrition(major);
    evidence = verification.evidence;
    actionLog = verification.actionLog;

    if (verification.errorMessage && evidence.length === 0) {
      throw new Error(verification.errorMessage);
    }
    if (!evidence.some((item) => item.status === "verified")) {
      throw new Error("Browserbase found no extractable nutrition facts for this recipe");
    }

    const reconciliation = await reconcileRecipeNutrition({
      title: recipe.title,
      servings: recipe.servings,
      ingredients,
      evidence,
    });

    const overallConfidence = capConfidenceByEvidence(
      reconciliation.confidence,
      evidence,
      reconciliation.fallbackIngredientCount,
    );
    const result: NutritionVerificationResult = {
      status: "succeeded",
      recipeTitle: recipe.title,
      servings: recipe.servings,
      aiCaloriesPerServing: recipe.calories_per_serving,
      estimatedCaloriesPerServing: reconciliation.estimated_calories_per_serving,
      overallConfidence,
      reasoning: reconciliation.reasoning,
      evidence,
      actionLog,
    };

    // Persist onto the recipe so cards and the planner can show evidence.
    const savedNutrition: SavedNutrition = {
      estimatedCaloriesPerServing: reconciliation.estimated_calories_per_serving,
      confidence: overallConfidence,
      estimationMethod: nutritionEstimationMethod(
        evidence,
        reconciliation.fallbackIngredientCount,
      ),
      reasoning: reconciliation.reasoning,
      evidence,
      verifiedAt: new Date().toISOString(),
    };
    const existingMeta =
      (recipe.source_metadata as Record<string, unknown> | null) ?? {};
    const confidenceScore = { high: 0.9, medium: 0.6, low: 0.3 }[
      overallConfidence
    ];
    const { error: updateError } = await supabase
      .from("recipes")
      .update({
        extraction_confidence: confidenceScore,
        source_metadata: { ...existingMeta, nutrition: savedNutrition },
      } as Partial<Recipe>)
      .eq("id", recipeId);
    if (updateError) {
      throw new Error(`Could not attach nutrition evidence to recipe: ${updateError.message}`);
    }

    if (importRow?.id) {
      await supabase
        .from("web_imports")
        .update({
          status: "succeeded",
          action_log: actionLog,
          extracted_json: { evidence, reconciliation } as unknown,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRow.id);
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nutrition verification failed";

    if (importRow?.id) {
      await supabase
        .from("web_imports")
        .update({
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", importRow.id);
    }

    const result: NutritionVerificationResult = {
      status: "failed",
      recipeTitle: recipe.title,
      servings: recipe.servings,
      aiCaloriesPerServing: recipe.calories_per_serving,
      estimatedCaloriesPerServing: null,
      overallConfidence: "low",
      reasoning: "",
      evidence,
      actionLog,
      errorMessage: message,
    };
    return NextResponse.json(result, { status: 422 });
  }
}
