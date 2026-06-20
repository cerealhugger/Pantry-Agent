import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyIngredientNutrition } from "@/lib/browserbase";
import { reconcileRecipeNutrition } from "@/lib/claude";
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

// Ingredients that rarely move the calorie needle or aren't real foods to search.
const SKIP_INGREDIENTS = [
  "water",
  "salt",
  "pepper",
  "black pepper",
  "ice",
  "to taste",
];

function selectMajorIngredients(ingredients: Ingredient[]): string[] {
  const names = ingredients
    .map((i) => i.name?.trim())
    .filter((n): n is string => Boolean(n))
    .filter((n) => {
      const lower = n.toLowerCase();
      return !SKIP_INGREDIENTS.some((skip) => lower === skip || lower.includes(skip));
    });
  return [...new Set(names.map((n) => n.toLowerCase()))];
}

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
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = (recipe.ingredients as Ingredient[]) ?? [];
  const major = selectMajorIngredients(ingredients);

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

  try {
    const { evidence, actionLog, errorMessage } = await verifyIngredientNutrition(major);

    if (errorMessage && evidence.length === 0) {
      throw new Error(errorMessage);
    }

    const reconciliation = await reconcileRecipeNutrition({
      title: recipe.title,
      servings: recipe.servings,
      ingredients,
      evidence,
    });

    const result: NutritionVerificationResult = {
      status: "succeeded",
      recipeTitle: recipe.title,
      servings: recipe.servings,
      aiCaloriesPerServing: recipe.calories_per_serving,
      estimatedCaloriesPerServing: reconciliation.estimated_calories_per_serving,
      overallConfidence: reconciliation.confidence,
      reasoning: reconciliation.reasoning,
      evidence,
      actionLog,
    };

    // Persist onto the recipe so cards and the planner can show evidence.
    const savedNutrition: SavedNutrition = {
      estimatedCaloriesPerServing: reconciliation.estimated_calories_per_serving,
      confidence: reconciliation.confidence,
      reasoning: reconciliation.reasoning,
      evidence,
      verifiedAt: new Date().toISOString(),
    };
    const existingMeta =
      (recipe.source_metadata as Record<string, unknown> | null) ?? {};
    const confidenceScore = { high: 0.9, medium: 0.6, low: 0.3 }[
      reconciliation.confidence
    ];
    await supabase
      .from("recipes")
      .update({
        extraction_confidence: confidenceScore,
        source_metadata: { ...existingMeta, nutrition: savedNutrition },
      } as Partial<Recipe>)
      .eq("id", recipeId);

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
      evidence: [],
      actionLog: [],
      errorMessage: message,
    };
    return NextResponse.json(result, { status: 422 });
  }
}
