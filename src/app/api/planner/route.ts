import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import type { InventoryItem, Recipe, Ingredient } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MealSlot = { day: string; meal: "breakfast" | "lunch" | "dinner" };
export type PlanEntry = MealSlot & { recipe_id: string; recipe_title: string; reason: string; eaten?: boolean };
export type IngredientShortage = {
  ingredient: string;
  usedInMeals: string[];
  totalNeededEstimate: string;
  inStock: string;
  note: string;
};

export async function POST(req: NextRequest) {
  const { locked, empty, weekStart } = await req.json() as {
    locked: PlanEntry[];
    empty: MealSlot[];
    weekStart: string;
  };

  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", "demo")
    .order("expiry_date", { ascending: true });

  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, ingredients, calories_per_serving, tags, source_type")
    .eq("user_id", "demo")
    .order("source_type", { ascending: false });

  const inventoryList = (inventory as InventoryItem[])
    .map((i) => `- ${i.name}: ${i.quantity ?? "?"} ${i.unit ?? "units"} (expires ${i.expiry_date ?? "unknown"})`)
    .join("\n");

  // Include ingredient details so Claude can do quantity math
  const recipeList = (recipes as Recipe[])
    .map((r) => {
      const ings = (r.ingredients as Ingredient[])
        .map((ing) => `${ing.qty ?? "?"} ${ing.unit ?? ""} ${ing.name}`.trim())
        .join(", ");
      return `- id:${r.id} | "${r.title}" | ${r.source_type} | ${r.calories_per_serving ?? "?"}kcal | ingredients: [${ings}]`;
    })
    .join("\n");

  const lockedSummary = locked.length
    ? locked.map((e) => `${e.day} ${e.meal}: "${e.recipe_title}"`).join("\n")
    : "none";

  const emptySlots = empty.map((s) => `${s.day} ${s.meal}`).join(", ");

  const prompt = `You are a meal planning assistant. Fill in the empty meal slots below.

RULES:
1. Prioritize recipes that use soon-to-expire ingredients.
2. Prefer imported/saved recipes (source_type = youtube or web_recipe) over seed recipes.
3. Avoid repeating the same recipe too many times — spread variety.
4. Each suggestion must be a recipe from the list below — use its exact id.
5. After choosing all meals, check if any ingredient is needed across multiple meals in quantities that may exceed what's in inventory. When units differ (e.g. inventory says "1 bag", recipe says "2 handfuls"), estimate equivalences and flag if the total usage likely exceeds stock. Only flag real concerns, not every ingredient.

INVENTORY (sorted by expiry, soonest first):
${inventoryList}

AVAILABLE RECIPES (with ingredients per serving):
${recipeList}

ALREADY PLANNED (locked, count these toward ingredient usage):
${lockedSummary}

SLOTS TO FILL: ${emptySlots}

Return ONLY valid JSON in this exact shape (no markdown, no extra text):
{
  "plan": [
    {
      "day": "Monday",
      "meal": "lunch",
      "recipe_id": "<exact id>",
      "recipe_title": "<exact title>",
      "reason": "<one sentence: why this slot>"
    }
  ],
  "shortages": [
    {
      "ingredient": "<ingredient name>",
      "usedInMeals": ["Monday lunch", "Wednesday dinner"],
      "totalNeededEstimate": "<e.g. ~600g total>",
      "inStock": "<e.g. 200g>",
      "note": "<one sentence explaining the shortage or unit estimation>"
    }
  ]
}

If no shortages are detected, return "shortages": [].`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  console.log("Claude planner stop_reason:", message.stop_reason);
  console.log("Claude planner raw:", text.slice(0, 400));

  // Extract the outermost JSON object
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("No JSON object in Claude response");
    return NextResponse.json({ error: "Claude returned invalid JSON", raw: text }, { status: 500 });
  }

  let parsed: { plan: PlanEntry[]; shortages: IngredientShortage[] };
  try {
    parsed = JSON.parse(match[0]);
  } catch (e) {
    console.error("JSON parse failed:", e);
    return NextResponse.json({ error: "JSON parse failed", raw: match[0].slice(0, 200) }, { status: 500 });
  }

  const suggestions = parsed.plan ?? [];
  const shortages = parsed.shortages ?? [];
  const fullPlan = [...locked, ...suggestions];

  await supabase.from("meal_plans").delete().eq("user_id", "demo").eq("week_start", weekStart);
  const { error: insertError } = await supabase.from("meal_plans").insert({
    user_id: "demo",
    week_start: weekStart,
    plan: fullPlan,
  });
  if (insertError) console.error("meal_plans insert error:", insertError);

  return NextResponse.json({ plan: fullPlan, shortages });
}
