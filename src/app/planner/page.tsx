"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Recipe, InventoryItem, Ingredient } from "@/lib/types";
import type { PlanEntry, MealSlot, IngredientShortage } from "@/app/api/planner/route";
import type { MissingIngredient } from "@/app/api/shopping-list/route";
import { foodEmoji } from "@/lib/food";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍲",
};

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
type Plan = Record<SlotKey, PlanEntry & { locked: boolean; eaten?: boolean }>;

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
  // per-meal "add missing to shopping list" state, keyed by `${day}-${meal}`
  const [mealCartAdding, setMealCartAdding] = useState<string | null>(null);
  const [mealCartAdded, setMealCartAdded] = useState<Record<string, boolean>>({});

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
          data.plan.forEach((e: any) => { p[`${e.day}-${e.meal}`] = { ...e, locked: e.locked ?? true, eaten: e.eaten ?? false }; });
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
    setMealCartAdded((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setPicker(null);
    setSaved(false);
    setCartAdded(false);
  }

  function handleClear(day: string, meal: string) {
    const key = `${day}-${meal}`;
    setPlan((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setMealCartAdded((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setSaved(false);
    setCartAdded(false);
  }

  async function handleClearAll() {
    if (!confirm("Clear all meals from this week's plan?")) return;
    setPlan({});
    setShortages([]);
    setSaved(false);
    setCartAdded(false);
    setMealCartAdded({});
    await supabase.from("meal_plans").delete().eq("user_id", "demo").eq("week_start", weekStart);
  }

  async function handleAutoFill() {
    setFilling(true);
    setSaved(false);
    setCartAdded(false);
    setMealCartAdded({});
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

  // Collect all missing ingredients across the whole plan (skip eaten meals)
  function getAllMissing(): MissingIngredient[] {
    const result: MissingIngredient[] = [];
    Object.values(plan).forEach((entry) => {
      if (entry.eaten) return;
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

  // Add only THIS meal's missing ingredients to the shopping list
  async function handleAddMealMissing(
    day: string,
    meal: string,
    recipe: Recipe,
    missing: Ingredient[]
  ) {
    if (!missing.length) return;
    const key = `${day}-${meal}`;
    setMealCartAdding(key);
    const items: MissingIngredient[] = missing.map((ing) => ({
      name: ing.name,
      qty: ing.qty,
      unit: ing.unit,
      neededFor: [recipe.title],
    }));
    await fetch("/api/shopping-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setMealCartAdding(null);
    setMealCartAdded((prev) => ({ ...prev, [key]: true }));
  }

  async function handleEat(day: string, meal: string) {
    const entry = slotEntry(day, meal);
    if (!entry) return;
    const res = await fetch("/api/planner/eat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: entry.recipe_id, day, meal, weekStart }),
    });
    if (res.ok) {
      setPlan((prev) => ({
        ...prev,
        [`${day}-${meal}`]: { ...prev[`${day}-${meal}`], eaten: true },
      }));
      // Refresh inventory after deduction
      supabase.from("inventory_items").select("*").eq("user_id", "demo")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then(({ data }: any) => setInventory(data ?? []));
    }
  }

  const allMissing = recipes.length > 0 && inventory.length > 0 ? getAllMissing() : [];
  const filledCount = Object.keys(plan).length;
  const totalSlots = DAYS.length * MEALS.length;

  return (
    <main className="px-4 pt-4">
      {/* heading + progress */}
      <div className="mb-3">
        <h1 className="text-xl font-bold tracking-tight text-ink">Meal Plan</h1>
        <p className="mt-0.5 text-xs font-medium text-muted">
          Week of {weekStart} · {filledCount}/{totalSlots} slots filled
        </p>
      </div>

      {/* action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={handleAutoFill}
          disabled={filling}
          className="col-span-3 rounded-2xl bg-brand-grad py-2.5 text-sm font-bold text-white shadow-md shadow-brand/25 transition active:scale-[0.99] disabled:opacity-60"
        >
          {filling ? "AI filling…" : "✨ Auto-fill empty slots"}
        </button>
        <button
          onClick={handleSave}
          className="col-span-2 rounded-2xl border border-brand/25 bg-brand-soft py-2.5 text-sm font-bold text-brand-dark transition active:scale-[0.99]"
        >
          Save plan
        </button>
        <button
          onClick={handleClearAll}
          className="rounded-2xl border border-coral/30 bg-coral/10 py-2.5 text-sm font-bold text-coral transition active:scale-[0.99]"
        >
          Clear all
        </button>
      </div>

      {saved && (
        <p className="mt-3 text-center text-xs font-semibold text-brand">✓ Plan saved</p>
      )}
      {fillError && (
        <p className="mt-3 text-center text-xs font-semibold text-coral">Error: {fillError}</p>
      )}

      {/* AI ingredient shortage warnings */}
      {shortages.length > 0 && (
        <div className="mt-4 rounded-2xl border border-amber/40 bg-amber/15 p-4">
          <p className="text-sm font-bold text-ink">
            ⚠ AI flagged {shortages.length} ingredient shortage{shortages.length !== 1 ? "s" : ""} this week
          </p>
          <ul className="mt-2 space-y-2">
            {shortages.map((s, i) => (
              <li key={`${s.ingredient}-${i}`} className="text-xs leading-snug text-ink/80">
                <span className="font-semibold text-[#a76a14]">{s.ingredient}</span>
                {" — "}
                {s.note}
                {s.usedInMeals.length > 0 && (
                  <span className="ml-1 text-muted">(used in: {s.usedInMeals.join(", ")})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* missing ingredients across the week */}
      {allMissing.length > 0 && (
        <div className="mt-4 rounded-2xl border border-coral/20 bg-coral/10 p-4">
          <p className="text-sm font-bold text-ink">
            🛒 {allMissing.length} missing ingredient{allMissing.length !== 1 ? "s" : ""} this week
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...new Map(allMissing.map((m) => [m.name.toLowerCase(), m])).values()].map((m, mi) => (
              <span
                key={`${m.name}-${mi}`}
                className="rounded-full border border-coral/30 bg-white/70 px-2.5 py-0.5 text-xs font-semibold text-coral"
              >
                {m.name}
                {m.qty ? ` · ${m.qty}${m.unit ? " " + m.unit : ""}` : ""}
              </span>
            ))}
          </div>
          <button
            onClick={handleAddToShoppingList}
            disabled={addingToCart || cartAdded}
            className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-60"
          >
            {cartAdded ? "✓ Added to Shopping List" : addingToCart ? "Adding…" : "Add all to Shopping List"}
          </button>
        </div>
      )}

      {allMissing.length === 0 && filledCount > 0 && inventory.length > 0 && (
        <p className="mt-4 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3 text-center text-sm font-semibold text-brand-dark">
          ✓ You have all ingredients for this week&apos;s plan
        </p>
      )}

      {/* vertical day-by-day plan */}
      <div className="mt-5 space-y-5">
        {DAYS.map((day) => (
          <section key={day}>
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink/70">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {day}
            </h2>
            <div className="space-y-2">
              {MEALS.map((meal) => {
                const entry = slotEntry(day, meal);
                const recipe = entry ? getRecipe(entry.recipe_id) : null;
                const missing = recipe && !entry?.eaten ? computeMissing(recipe, inventory) : [];

                return (
                  <div key={meal}>
                    {entry ? (
                      <div className={`relative rounded-2xl border px-3.5 py-3 shadow-sm transition ${
                        entry.eaten ? "border-green-200 bg-green-50" : "border-black/5 bg-white"
                      }`}>
                        <div className="flex gap-3">
                          {recipe && !entry.eaten ? (
                            <Link
                              href={`/recipes/${entry.recipe_id}`}
                              className="flex min-w-0 flex-1 gap-3 pr-5 transition active:scale-[0.99]"
                            >
                              <span
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
                                  entry.locked ? "bg-brand-soft" : "bg-amber/20"
                                }`}
                              >
                                {foodEmoji(entry.recipe_title, null)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                  {MEAL_EMOJI[meal]} {meal}
                                </p>
                                <p className="truncate font-semibold text-ink">
                                  {entry.recipe_title}
                                  <span className="ml-1 text-xs font-bold text-brand">→</span>
                                </p>
                                {!entry.locked && entry.reason && (
                                  <p className="mt-0.5 text-[11px] leading-tight text-brand">{entry.reason}</p>
                                )}
                              </div>
                            </Link>
                          ) : (
                            <div className="flex min-w-0 flex-1 gap-3 pr-5">
                              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
                                entry.eaten ? "bg-green-100" : "bg-amber/20"
                              }`}>
                                {recipe ? foodEmoji(entry.recipe_title, null) : MEAL_EMOJI[meal]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                  {MEAL_EMOJI[meal]} {meal}
                                </p>
                                <p className="truncate font-semibold text-ink">{entry.recipe_title}</p>
                                {entry.eaten ? (
                                  <p className="mt-0.5 text-[11px] font-semibold text-green-600">
                                    ✓ Eaten · inventory updated
                                  </p>
                                ) : (
                                  <p className="mt-0.5 text-[11px] text-muted">Recipe unavailable</p>
                                )}
                              </div>
                            </div>
                          )}
                          <button
                            onClick={() => handleClear(day, meal)}
                            aria-label="Remove meal"
                            className="absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-muted transition hover:text-coral"
                          >
                            ✕
                          </button>
                        </div>

                        {/* pantry check / eaten status */}
                        {entry.eaten ? (
                          <div className="mt-2.5 border-t border-green-200 pt-2.5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-600 text-[10px] text-white">✓</span>
                              Eaten · ingredients deducted from pantry
                            </p>
                          </div>
                        ) : recipe ? (
                          <div className="mt-2.5 border-t border-black/5 pt-2.5">
                            {missing.length === 0 ? (
                              <div className="flex items-center justify-between">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-brand">
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                                    ✓
                                  </span>
                                  Pantry has everything
                                </p>
                                <button
                                  onClick={() => handleEat(day, meal)}
                                  className="rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-green-500 active:scale-95"
                                >
                                  ✓ Ate this
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-coral">
                                    Need {missing.length} item{missing.length !== 1 ? "s" : ""}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAddMealMissing(day, meal, recipe, missing)}
                                      disabled={
                                        mealCartAdding === `${day}-${meal}` ||
                                        mealCartAdded[`${day}-${meal}`]
                                      }
                                      className="flex-shrink-0 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white transition active:scale-95 disabled:opacity-60"
                                    >
                                      {mealCartAdded[`${day}-${meal}`]
                                        ? "✓ Added"
                                        : mealCartAdding === `${day}-${meal}`
                                        ? "Adding…"
                                        : "+ Shopping list"}
                                    </button>
                                    <button
                                      onClick={() => handleEat(day, meal)}
                                      className="flex-shrink-0 rounded-full bg-green-600 px-3 py-1 text-[11px] font-bold text-white transition hover:bg-green-500 active:scale-95"
                                    >
                                      ✓ Ate this
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                  {missing.map((m, mi) => (
                                    <span
                                      key={`${m.name}-${mi}`}
                                      className="rounded-full bg-coral/15 px-2 py-0.5 text-[10px] font-semibold text-coral"
                                    >
                                      {m.name}
                                    </span>
                                  ))}
                                </div>
                              </>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        onClick={() => setPicker({ day, meal })}
                        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-black/15 bg-white/50 px-3.5 py-3 text-left text-sm font-medium text-muted transition hover:border-brand/40 hover:text-brand-dark"
                      >
                        <span className="text-base">{MEAL_EMOJI[meal]}</span>
                        <span className="capitalize">+ Add {meal}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* recipe picker — bottom sheet */}
      {picker && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setPicker(null)}
        >
          <div
            className="flex max-h-[78vh] w-full max-w-[440px] flex-col rounded-t-3xl bg-cream shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-3 pt-4">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-black/15" />
              <h2 className="text-base font-bold text-ink">
                {picker.day} · <span className="capitalize">{picker.meal}</span>
              </h2>
              <p className="mt-0.5 text-xs font-medium text-muted">Pick a recipe</p>
            </div>
            <ul className="flex-1 space-y-2 overflow-y-auto px-4 pb-2">
              {recipes.map((r) => {
                const missing = computeMissing(r, inventory);
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleManualSelect(r)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 text-left shadow-sm transition active:scale-[0.99]"
                    >
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xl">
                        {foodEmoji(r.title, null)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{r.title}</p>
                        <p className="text-xs text-muted">
                          {r.source_type} · {r.calories_per_serving ?? "?"} kcal
                        </p>
                      </div>
                      {missing.length > 0 ? (
                        <span className="flex-shrink-0 rounded-full bg-coral/15 px-2 py-0.5 text-xs font-semibold text-coral">
                          {missing.length} missing
                        </span>
                      ) : (
                        <span className="flex-shrink-0 text-xs font-semibold text-brand">✓ ready</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="px-4 pb-5 pt-2">
              <button
                onClick={() => setPicker(null)}
                className="w-full rounded-xl border border-black/10 bg-white py-2.5 text-sm font-bold text-muted transition active:scale-[0.99]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
