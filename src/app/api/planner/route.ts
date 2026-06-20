import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import type { InventoryItem, Recipe } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type MealSlot = { day: string; meal: "breakfast" | "lunch" | "dinner" };
export type PlanEntry = MealSlot & { recipe_id: string; recipe_title: string; reason: string };

export async function POST(req: NextRequest) {
  // locked = slots the user already chose manually (don't touch these)
  // empty  = slots we need Claude to fill
  const { locked, empty, weekStart } = await req.json() as {
    locked: PlanEntry[];
    empty: MealSlot[];
    weekStart: string;
  };

  // Fetch inventory sorted by expiry
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", "demo")
    .order("expiry_date", { ascending: true });

  // Fetch recipes — prefer imported over seed
  const { data: recipes } = await supabase
    .from("recipes")
    .select("id, title, ingredients, calories_per_serving, tags, source_type")
    .eq("user_id", "demo")
    .order("source_type", { ascending: false }); // seed < web_recipe/youtube alphabetically

  const inventoryList = (inventory as InventoryItem[])
    .map((i) => `- ${i.name} (${i.quantity ?? "?"} ${i.unit ?? ""}, expires ${i.expiry_date})`)
    .join("\n");

  const recipeList = (recipes as Recipe[])
    .map((r) => `- id:${r.id} | "${r.title}" | ${r.source_type} | ${r.calories_per_serving ?? "?"}kcal | tags:${(r.tags as string[]).join(",")}`)
    .join("\n");

  const lockedSummary = locked.length
    ? locked.map((e) => `${e.day} ${e.meal}: "${e.recipe_title}"`).join("\n")
    : "none";

  const emptySlots = empty.map((s) => `${s.day} ${s.meal}`).join(", ");

  const prompt = `You are a meal planning assistant. Fill in the empty meal slots below.

RULES:
1. Prioritize recipes that use soon-to-expire ingredients.
2. Prefer imported/saved recipes (source_type = youtube or web_recipe) over seed recipes.
3. Avoid repeating the same recipe in the same week (check locked meals).
4. Each suggestion must be a recipe from the list below — use its exact id.

INVENTORY (sorted by expiry, soonest first):
${inventoryList}

AVAILABLE RECIPES:
${recipeList}

ALREADY PLANNED (do not repeat these):
${lockedSummary}

SLOTS TO FILL: ${emptySlots}

Return ONLY a valid JSON array, one object per slot:
[
  {
    "day": "Monday",
    "meal": "lunch",
    "recipe_id": "<exact id from list>",
    "recipe_title": "<exact title>",
    "reason": "<one short sentence: why this recipe for this slot>"
  }
]`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return NextResponse.json({ error: "Claude returned invalid JSON" }, { status: 500 });

  const suggestions = JSON.parse(match[0]) as PlanEntry[];

  // Merge locked + suggestions and upsert into meal_plans
  const fullPlan = [...locked, ...suggestions];
  await supabase.from("meal_plans").upsert({
    user_id: "demo",
    week_start: weekStart,
    plan: fullPlan,
  }, { onConflict: "user_id,week_start" });

  return NextResponse.json({ plan: fullPlan });
}
