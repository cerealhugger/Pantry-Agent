import { NextRequest, NextResponse } from "next/server";
import { importRecipe } from "@/lib/browserbase";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  if (!url) return NextResponse.json({ error: "No URL provided" }, { status: 400 });

  const { data: importRow } = await supabase
    .from("web_imports")
    .insert({
      user_id: "demo",
      input_url: url,
      import_type: url.includes("youtube") ? "youtube" : "recipe_url",
      status: "running",
    })
    .select()
    .single();

  const importId = importRow?.id;

  // Run Browserbase import
  const result = await importRecipe(url);

  if (result.status === "succeeded" && result.recipe) {
    // Save recipe
    const { data: recipeRow } = await supabase
      .from("recipes")
      .insert({
        user_id: "demo",
        title: result.recipe.title,
        ingredients: result.recipe.ingredients,
        steps: result.recipe.steps,
        calories_per_serving: result.recipe.calories_per_serving,
        servings: result.recipe.servings,
        tags: result.recipe.tags,
        source_type: result.importType === "youtube" ? "youtube" : "web_recipe",
        source_url: url,
        browserbase_session_id: result.browserbaseSessionId ?? null,
        browserbase_replay_url: result.browserbaseReplayUrl ?? null,
        extraction_mode: result.extractionMode,
        source_metadata: {},
      })
      .select()
      .single();

    // Update web_imports row
    if (importId) {
      await supabase.from("web_imports").update({
        status: "succeeded",
        browserbase_session_id: result.browserbaseSessionId ?? null,
        browserbase_replay_url: result.browserbaseReplayUrl ?? null,
        extraction_mode: result.extractionMode,
        action_log: result.actionLog,
        extracted_json: result.recipe,
        completed_at: new Date().toISOString(),
      }).eq("id", importId);
    }

    return NextResponse.json({ success: true, recipe: recipeRow, actionLog: result.actionLog });
  } else {
    if (importId) {
      await supabase.from("web_imports").update({
        status: "failed",
        action_log: result.actionLog,
        error_message: result.errorMessage,
        completed_at: new Date().toISOString(),
      }).eq("id", importId);
    }
    return NextResponse.json({ success: false, error: result.errorMessage, actionLog: result.actionLog }, { status: 500 });
  }
}
