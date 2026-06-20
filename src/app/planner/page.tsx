"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Recipe, InventoryItem, Ingredient } from "@/lib/types";
import type { PlanEntry, MealSlot, IngredientShortage } from "@/app/api/planner/route";
import type { MissingIngredient } from "@/app/api/shopping-list/route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

function getNextMonday() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? 1 : 8 - day);
  const mon = new Date(d);
  mon.setDate(diff);
  mon.setHours(0, 0, 0, 0);
  return mon.toISOString().split("T")[0];
}

type SlotKey = string;
type Plan = Record<SlotKey, PlanEntry & { locked: boolean }>;

// Compare recipe ingredients against inventory, return missing ones
function computeMissing(
  recipe: Recipe,
  inventory: InventoryItem[]
): Ingredient[] {
  const ingredients = recipe.ingredients as Ingredient[];
  return ingredients.filter((ing) => {
    const inStock = inventory.find(
      (item) => item.name.toLowerCase().includes(ing.name.toLowerCase()) ||
                ing.name.toLowerCase().includes(item.name.toLowerCase())
    );
    return !inStock;
  });
}

export default function PlannerPage() {
  const weekStart = getNextMonday();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [plan, setPlan] = useState<Plan>({});
  const [shortages, setShortages] = useState<IngredientShortage[]>([]);
  const [filling, setFilling] = useState(false);
  const [fillError, setFillError] = useState<string | null>(null);
  const [picker, setPicker] = useState<MealSlot | null>(null);
  const [saved, setSaved] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  useEffect(() => {
    supabase.from("recipes").select("*").eq("user_id", "demo")
      .order("source_type", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setRecipes(data ?? []));

    supabase.from("inventory_items").select("*").eq("user_id", "demo")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setInventory(data ?? []));

    supabase.from("meal_plans").select("*").eq("user_id", "demo").eq("week_start", weekStart).single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => {
        if (data?.plan) {
          const p: Plan = {};
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data.plan.forEach((e: any) => { p[`${e.day}-${e.meal}`] = { ...e, locked: e.locked ?? true }; });
          setPlan(p);
        }
      });
  }, [weekStart]);

  function getRecipe(id: string) {
    return recipes.find((r) => r.id === id) ?? null;
  }

  function slotEntry(day: string, meal: string) {
    return plan[`${day}-${meal}`] ?? null;
  }

  function handleManualSelect(recipe: Recipe) {
    if (!picker) return;
    const key = `${picker.day}-${picker.meal}`;
    setPlan((prev) => ({
      ...prev,
      [key]: { day: picker.day, meal: picker.meal as "breakfast" | "lunch" | "dinner", recipe_id: recipe.id, recipe_title: recipe.title, reason: "Manually selected", locked: true },
    }));
    setPicker(null);
    setSaved(false);
    setCartAdded(false);
  }

  function handleClear(day: string, meal: string) {
    setPlan((prev) => { const next = { ...prev }; delete next[`${day}-${meal}`]; return next; });
    setSaved(false);
    setCartAdded(false);
  }

  async function handleClearAll() {
    if (!confirm("Clear all meals from this week's plan?")) return;
    setPlan({});
    setShortages([]);
    setSaved(false);
    setCartAdded(false);
    await supabase.from("meal_plans").delete().eq("user_id", "demo").eq("week_start", weekStart);
  }

  async function handleAutoFill() {
    setFilling(true);
    setSaved(false);
    setCartAdded(false);
    setFillError(null);
    setShortages([]);
    const locked: PlanEntry[] = [];
    const empty: MealSlot[] = [];
    DAYS.forEach((day) => {
      MEALS.forEach((meal) => {
        const entry = slotEntry(day, meal);
        if (entry) locked.push({ day, meal, recipe_id: entry.recipe_id, recipe_title: entry.recipe_title, reason: entry.reason });
        else empty.push({ day, meal });
      });
    });
    if (empty.length === 0) { setFilling(false); return; }
    const res = await fetch("/api/planner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked, empty, weekStart }),
    });
    const data = await res.json();
    if (data.plan) {
      const p: Plan = {};
      (data.plan as (PlanEntry & { locked?: boolean })[]).forEach((e) => {
        p[`${e.day}-${e.meal}`] = { ...e, locked: e.locked ?? false };
      });
      setPlan(p);
      setShortages(data.shortages ?? []);
      setSaved(true);
    } else {
      setFillError(data.error ?? "Auto-fill failed");
    }
    setFilling(false);
  }

  async function handleSave() {
    const fullPlan = Object.values(plan).map(({ locked: _l, ...e }) => e);
    await supabase.from("meal_plans").upsert(
      { user_id: "demo", week_start: weekStart, plan: fullPlan },
      { onConflict: "user_id,week_start" }
    );
    setSaved(true);
  }

  // Collect all missing ingredients across the whole plan
  function getAllMissing(): MissingIngredient[] {
    const result: MissingIngredient[] = [];
    Object.values(plan).forEach((entry) => {
      const recipe = getRecipe(entry.recipe_id);
      if (!recipe) return;
      const missing = computeMissing(recipe, inventory);
      missing.forEach((ing) => {
        result.push({ name: ing.name, qty: ing.qty, unit: ing.unit, neededFor: [recipe.title] });
      });
    });
    return result;
  }

  async function handleAddToShoppingList() {
    const missing = getAllMissing();
    if (!missing.length) return;
    setAddingToCart(true);
    await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: missing }),
    });
    setAddingToCart(false);
    setCartAdded(true);
  }

  const allMissing = recipes.length > 0 && inventory.length > 0 ? getAllMissing() : [];
  const filledCount = Object.keys(plan).length;
  const totalSlots = DAYS.length * MEALS.length;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Planner</h1>
          <p className="text-sm text-gray-400 mt-0.5">Week of {weekStart} · {filledCount}/{totalSlots} slots filled</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleAutoFill} disabled={filling}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50">
            {filling ? "AI filling…" : "✨ Auto-fill empty slots"}
          </button>
          <button onClick={handleSave}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400">
            Save
          </button>
          <button onClick={handleClearAll}
            className="px-4 py-2 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:border-red-400 hover:bg-red-50">
            Clear all
          </button>
        </div>
      </div>

      {saved && <p className="mb-3 text-sm text-green-600 font-medium">✓ Plan saved</p>}
      {fillError && <p className="mb-3 text-sm text-red-600 font-medium">Error: {fillError}</p>}

      {/* Ingredient shortage warnings from AI */}
      {shortages.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-300 bg-yellow-50 px-4 py-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">
            ⚠ AI detected {shortages.length} potential ingredient shortage{shortages.length !== 1 ? "s" : ""} this week
          </p>
          <ul className="space-y-2">
            {shortages.map((s) => (
              <li key={s.ingredient} className="text-xs text-yellow-900">
                <span className="font-semibold">{s.ingredient}</span>
                {" — "}
                {s.note}
                {s.usedInMeals.length > 0 && (
                  <span className="text-yellow-600 ml-1">
                    (used in: {s.usedInMeals.join(", ")})
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Calendar grid */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse min-w-[700px]">
          <thead>
            <tr>
              <th className="w-20 pb-2" />
              {DAYS.map((d) => (
                <th key={d} className="pb-2 text-xs font-semibold text-gray-500 text-center">{d}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MEALS.map((meal) => (
              <tr key={meal}>
                <td className="py-2 pr-3 text-xs font-semibold text-gray-400 uppercase text-right align-top pt-3">{meal}</td>
                {DAYS.map((day) => {
                  const entry = slotEntry(day, meal);
                  const recipe = entry ? getRecipe(entry.recipe_id) : null;
                  const missing = recipe ? computeMissing(recipe, inventory) : [];

                  return (
                    <td key={day} className="p-1 align-top">
                      {entry ? (
                        <div className={`rounded-xl p-2.5 text-xs group relative min-h-[72px] ${entry.locked ? "bg-gray-900 text-white" : "bg-blue-50 border border-blue-200 text-blue-900"}`}>
                          <p className="font-semibold leading-snug pr-4">{entry.recipe_title}</p>
                          {!entry.locked && (
                            <p className="mt-1 text-blue-600 opacity-80 text-[10px] leading-tight">{entry.reason}</p>
                          )}
                          {missing.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {missing.map((m) => (
                                <span key={m.name} className="px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-medium">
                                  {m.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <button onClick={() => handleClear(day, meal)}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity">
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setPicker({ day, meal })}
                          className="w-full min-h-[72px] rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 text-gray-300 hover:text-gray-500 text-xl transition-colors">
                          +
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Missing ingredients summary */}
      {allMissing.length > 0 && (
        <div className="mt-6 rounded-xl border border-orange-200 bg-orange-50 px-4 py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="font-semibold text-orange-800 text-sm">
                {allMissing.length} missing ingredient{allMissing.length !== 1 ? "s" : ""} across this week's plan
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {/* Dedupe by name */}
                {[...new Map(allMissing.map((m) => [m.name.toLowerCase(), m])).values()].map((m) => (
                  <span key={m.name} className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium border border-orange-200">
                    {m.name}
                    {m.qty ? ` · ${m.qty}${m.unit ? " " + m.unit : ""}` : ""}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={handleAddToShoppingList}
              disabled={addingToCart || cartAdded}
              className="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-semibold disabled:opacity-60 whitespace-nowrap"
            >
              {cartAdded ? "✓ Added to Shopping List" : addingToCart ? "Adding…" : "Add all to Shopping List"}
            </button>
          </div>
        </div>
      )}

      {allMissing.length === 0 && filledCount > 0 && inventory.length > 0 && (
        <p className="mt-4 text-sm text-green-600 font-medium">✓ You have all ingredients for this week's plan</p>
      )}

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPicker(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">{picker.day} — {picker.meal}</h2>
              <p className="text-xs text-gray-400 mt-0.5">Pick a recipe</p>
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {recipes.map((r) => {
                const missing = computeMissing(r, inventory);
                return (
                  <li key={r.id}>
                    <button onClick={() => handleManualSelect(r)} className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-gray-900">{r.title}</p>
                        {missing.length > 0 && (
                          <span className="text-xs text-orange-500 font-medium">{missing.length} missing</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{r.source_type} · {r.calories_per_serving ?? "?"}kcal</p>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="px-5 py-3 border-t border-gray-100">
              <button onClick={() => setPicker(null)} className="text-sm text-gray-400 hover:text-gray-700">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
