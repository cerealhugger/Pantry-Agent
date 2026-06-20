import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { InventoryItem, Ingredient } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function fuzzyMatch(inventoryName: string, ingredientName: string): boolean {
  const a = inventoryName.toLowerCase();
  const b = ingredientName.toLowerCase();
  return a.includes(b) || b.includes(a);
}

function unitsCompatible(u1: string | null, u2: string | null): boolean {
  if (!u1 || !u2) return true; // null unit = count-based, treat as compatible
  return u1.toLowerCase() === u2.toLowerCase();
}

export async function POST(req: NextRequest) {
  const { recipe_id, day, meal, weekStart } = await req.json() as {
    recipe_id: string;
    day: string;
    meal: string;
    weekStart: string;
  };

  // 1. Fetch the recipe
  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, title, ingredients, calories_per_serving")
    .eq("id", recipe_id)
    .single();

  if (recipeError || !recipe) {
    return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
  }

  const ingredients = recipe.ingredients as Ingredient[];

  // 2. Fetch inventory
  const { data: inventory } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", "demo");

  const items = (inventory ?? []) as InventoryItem[];

  // 3. Deduct each ingredient from inventory
  const deducted: string[] = [];
  const skipped: string[] = [];

  for (const ing of ingredients) {
    const match = items.find((item) => fuzzyMatch(item.name, ing.name));
    if (!match) {
      skipped.push(`${ing.name} (not in inventory)`);
      continue;
    }

    if (!unitsCompatible(match.unit, ing.unit)) {
      skipped.push(`${ing.name} (unit mismatch: have ${match.unit}, need ${ing.unit})`);
      continue;
    }

    if (match.quantity == null || ing.qty == null) {
      // No quantity info — just flag as used without deducting a number
      deducted.push(ing.name);
      continue;
    }

    const remaining = match.quantity - ing.qty;
    if (remaining <= 0) {
      // Used it all up — delete the item
      await supabase.from("inventory_items").delete().eq("id", match.id);
    } else {
      await supabase
        .from("inventory_items")
        .update({ quantity: remaining })
        .eq("id", match.id);
    }
    deducted.push(ing.name);
  }

  // 4. Log to diet_log
  await supabase.from("diet_log").insert({
    user_id: "demo",
    log_date: new Date().toISOString().split("T")[0],
    meal,
    description: recipe.title,
    calories: recipe.calories_per_serving,
    source: "recipe",
    recipe_id: recipe.id,
  });

  // 5. Mark the slot as eaten in meal_plans
  const { data: planRow } = await supabase
    .from("meal_plans")
    .select("id, plan")
    .eq("user_id", "demo")
    .eq("week_start", weekStart)
    .single();

  if (planRow) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatedPlan = (planRow.plan as any[]).map((entry: any) =>
      entry.day === day && entry.meal === meal
        ? { ...entry, eaten: true }
        : entry
    );
    await supabase
      .from("meal_plans")
      .update({ plan: updatedPlan })
      .eq("id", planRow.id);
  }

  return NextResponse.json({ ok: true, deducted, skipped });
}
