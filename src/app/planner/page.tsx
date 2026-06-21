"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Recipe, InventoryItem, Ingredient } from "@/lib/types";
import type { PlanEntry, MealSlot, IngredientShortage } from "@/app/api/planner/route";
import type { MissingIngredient } from "@/app/api/shopping-list/route";
import { mealEmoji } from "@/lib/food";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_ABBR = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

const MEAL_EMOJI: Record<string, string> = {
  breakfast: "🍳",
  lunch: "🥗",
  dinner: "🍲",
};

// Calendar date (day-of-month) for the i-th day of the planned week.
function dayOfMonth(weekStart: string, offset: number): number {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + offset);
  return dt.getDate();
}

// localStorage key for the ingredients the user explicitly put on the shopping
// list from the planner this week (drives the "missing" block's persistence).
const addedKey = (weekStart: string) => `pantryagent:added:${weekStart}`;

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
  // which day's recipes are shown; defaults to today, resolved on the client to
  // avoid SSR hydration mismatch.
  const [selectedDay, setSelectedDay] = useState(DAYS[0]);
  const [saved, setSaved] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
  // "adding…" spinner key, `${day}-${meal}`
  const [mealCartAdding, setMealCartAdding] = useState<string | null>(null);
  // lowercased ingredient names the user has added to the shopping list this session.
  // Once added, an ingredient drops out of the "missing" display.
  // qty of each ingredient (by lowercased name) the user has added to the shopping list
  // this session. An ingredient leaves "missing" only once its needed qty is covered.
  const [addedQty, setAddedQty] = useState<Map<string, number>>(new Map());

  // is this ingredient's needed quantity fully on the shopping list?
  function isOnList(name: string, qty: number | null): boolean {
    const have = addedQty.get(name.toLowerCase()) ?? 0;
    if (qty == null) return have > 0; // no qty specified → any amount covers it
    return have >= Number(qty);
  }

  // accumulate added quantities (null qty counts as +1 so it registers as covered)
  // and persist to localStorage so the user's explicit adds survive a reload.
  function recordAdded(ings: { name: string; qty: number | null }[]) {
    setAddedQty((prev) => {
      const next = new Map(prev);
      for (const ing of ings) {
        const k = ing.name.toLowerCase();
        next.set(k, (next.get(k) ?? 0) + (ing.qty == null ? 1 : Number(ing.qty)));
      }
      try {
        localStorage.setItem(addedKey(weekStart), JSON.stringify([...next]));
      } catch {
        /* ignore unavailable storage */
      }
      return next;
    });
  }

  useEffect(() => {
    const idx = (new Date().getDay() + 6) % 7; // JS Sun=0 → our Mon=0..Sun=6
    setSelectedDay(DAYS[idx]);
  }, []);

  useEffect(() => {
    supabase.from("recipes").select("*").eq("user_id", "demo")
      .order("source_type", { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setRecipes(data ?? []));

    supabase.from("inventory_items").select("*").eq("user_id", "demo")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then(({ data }: any) => setInventory(data ?? []));

    // Persist ONLY the ingredients the user explicitly added from the planner
    // (not the whole shopping list) so the "missing" block doesn't revert on
    // reload — and nothing is auto-hidden just for being on the shopping list.
    try {
      const raw = localStorage.getItem(addedKey(weekStart));
      if (raw) setAddedQty(new Map(JSON.parse(raw) as [string, number][]));
    } catch {
      /* ignore malformed/unavailable storage */
    }

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

  function recipeCalories(recipe: Recipe | null): number | null {
    return recipe?.source_metadata?.nutrition?.estimatedCaloriesPerServing ??
      recipe?.calories_per_serving ??
      null;
  }

  function eatenCaloriesForDay(day: string) {
    return MEALS.reduce((total, meal) => {
      const entry = slotEntry(day, meal);
      if (!entry?.eaten) return total;
      return total + (recipeCalories(getRecipe(entry.recipe_id)) ?? 0);
    }, 0);
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
    const key = `${day}-${meal}`;
    setPlan((prev) => { const next = { ...prev }; delete next[key]; return next; });
    setSaved(false);
    setCartAdded(false);
  }

  // Drag a meal onto another slot to change its day/meal. If the target slot is
  // filled, the two meals swap; otherwise the source slot empties.
  function moveMeal(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    setPlan((prev) => {
      const fromEntry = prev[fromKey];
      if (!fromEntry) return prev;
      const [fd, fm] = fromKey.split("-");
      const [td, tm] = toKey.split("-");
      const next = { ...prev };
      const toEntry = prev[toKey];
      next[toKey] = { ...fromEntry, day: td, meal: tm as "breakfast" | "lunch" | "dinner" };
      if (toEntry) {
        next[fromKey] = { ...toEntry, day: fd, meal: fm as "breakfast" | "lunch" | "dinner" };
      } else {
        delete next[fromKey];
      }
      return next;
    });
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

  // Collect all missing ingredients across the whole plan (skip eaten meals)
  function getAllMissing(): MissingIngredient[] {
    const result: MissingIngredient[] = [];
    Object.values(plan).forEach((entry) => {
      if (entry.eaten) return;
      const recipe = getRecipe(entry.recipe_id);
      if (!recipe) return;
      const missing = computeMissing(recipe, inventory);
      missing.forEach((ing) => {
        if (isOnList(ing.name, ing.qty)) return; // needed qty already on the list
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
    recordAdded(missing);
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
    recordAdded(missing);
    setMealCartAdding(null);
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
          <p className="mb-2 text-sm font-bold text-ink">⚠ May run short this week</p>
          <div className="flex flex-wrap gap-1.5">
            {shortages.map((s, i) => (
              <span
                key={`${s.ingredient}-${i}`}
                className="rounded-full border border-amber/40 bg-white/60 px-2.5 py-0.5 text-xs font-semibold text-[#a76a14]"
              >
                {s.ingredient}
              </span>
            ))}
          </div>
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

      {/* week strip — pick a day to see its recipes; drop a meal on a day to move it */}
      <div className="mt-5">
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((day, i) => {
            const isSel = selectedDay === day;
            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData("text/plain");
                  if (!from) return;
                  const fromMeal = from.split("-")[1];
                  moveMeal(from, `${day}-${fromMeal}`);
                  setSelectedDay(day);
                }}
                className={`flex flex-col items-center rounded-xl py-2 transition active:scale-95 ${
                  isSel ? "bg-brand text-white shadow-sm shadow-brand/25" : "bg-white text-ink shadow-sm"
                }`}
              >
                <span className="text-[10px] font-bold uppercase tracking-wide">{DAY_ABBR[i]}</span>
                <span
                  className={`mt-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    isSel ? "bg-white/25 text-white" : "bg-brand-soft text-brand-dark"
                  }`}
                >
                  {dayOfMonth(weekStart, i)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* selected day's plan */}
      <div className="mt-5 space-y-5">
        {DAYS.filter((day) => day === selectedDay).map((day) => {
          const eatenCalories = eatenCaloriesForDay(day);
          return (
            <section key={day}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-bold text-ink/70">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {day}
                </h2>
                {eatenCalories > 0 && (
                  <span className="flex-shrink-0 text-xs font-semibold text-muted">
                    {eatenCalories} kcal
                  </span>
                )}
              </div>
              <div className="space-y-2">
              {MEALS.map((meal) => {
                const entry = slotEntry(day, meal);
                const recipe = entry ? getRecipe(entry.recipe_id) : null;
                const missing = recipe && !entry?.eaten ? computeMissing(recipe, inventory) : [];
                // still missing AND not yet added to the shopping list
                const pending = missing.filter((m) => !isOnList(m.name, m.qty));

                return (
                  <div
                    key={meal}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const from = e.dataTransfer.getData("text/plain");
                      if (from) moveMeal(from, `${day}-${meal}`);
                    }}
                  >
                    {entry ? (
                      <div
                        draggable={!entry.eaten}
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", `${day}-${meal}`);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={`relative rounded-2xl border px-3.5 py-3 shadow-sm transition ${
                          entry.eaten ? "border-black/10 bg-black/5 opacity-80" : "cursor-grab border-black/5 bg-white active:cursor-grabbing"
                        }`}
                      >
                        <div className="flex gap-3">
                          {recipe && !entry.eaten ? (
                            <Link
                              href={`/recipes/${entry.recipe_id}`}
                              draggable={false}
                              className="flex min-w-0 flex-1 gap-3 pr-5 transition active:scale-[0.99]"
                            >
                              <span
                                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
                                  entry.locked ? "bg-brand-soft" : "bg-amber/20"
                                }`}
                              >
                                {mealEmoji(entry.recipe_title)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                  {MEAL_EMOJI[meal]} {meal}
                                </p>
                                <p className="truncate font-semibold text-ink">
                                  {entry.recipe_title}
                                  <span className="ml-1 text-xs font-bold text-brand">→</span>
                                </p>
                                {recipe?.source_metadata?.nutrition ? (
                                  <p className="mt-0.5 text-[11px] font-medium leading-tight text-brand-dark">
                                    {recipe.source_metadata.nutrition.estimatedCaloriesPerServing ?? "?"} kcal ·{" "}
                                    {recipe.source_metadata.nutrition.confidence} ✓ verified
                                  </p>
                                ) : (
                                  recipe?.calories_per_serving != null && (
                                    <p className="mt-0.5 text-[11px] leading-tight text-muted">
                                      {recipe.calories_per_serving} kcal
                                    </p>
                                  )
                                )}
                                {!entry.locked && entry.reason && (
                                  <p className="mt-0.5 text-[11px] leading-tight text-brand">{entry.reason}</p>
                                )}
                              </div>
                            </Link>
                          ) : (
                            <div className="flex min-w-0 flex-1 gap-3 pr-5">
                              <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xl ${
                                entry.eaten ? "bg-black/10 grayscale" : "bg-amber/20"
                              }`}>
                                {recipe ? mealEmoji(entry.recipe_title) : MEAL_EMOJI[meal]}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
                                  {MEAL_EMOJI[meal]} {meal}
                                </p>
                                <p className={`truncate font-semibold ${entry.eaten ? "text-muted" : "text-ink"}`}>
                                  {entry.recipe_title}
                                </p>
                                {!recipe && !entry.eaten && (
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
                          <div className="mt-2.5 border-t border-black/10 pt-2.5">
                            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[10px] text-white">✓</span>
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
                            ) : pending.length === 0 ? (
                              // all missing items are now on the shopping list
                              <div className="flex items-center justify-between">
                                <p className="flex items-center gap-1.5 text-xs font-semibold text-[#a76a14]">
                                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-amber" />
                                  {missing.length} on shopping list
                                </p>
                                <Link
                                  href="/shopping"
                                  className="rounded-full border border-brand/25 bg-brand-soft px-3 py-1 text-[11px] font-bold text-brand-dark transition active:scale-95"
                                >
                                  View list →
                                </Link>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold text-coral">
                                    Need {pending.length} item{pending.length !== 1 ? "s" : ""}
                                  </p>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAddMealMissing(day, meal, recipe, pending)}
                                      disabled={mealCartAdding === `${day}-${meal}`}
                                      className="flex-shrink-0 rounded-full bg-brand px-3 py-1 text-[11px] font-bold text-white transition active:scale-95 disabled:opacity-60"
                                    >
                                      {mealCartAdding === `${day}-${meal}` ? "Adding…" : "+ Shopping list"}
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
                                  {pending.map((m, mi) => (
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
          );
        })}
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
                        {mealEmoji(r.title)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{r.title}</p>
                        <p className="text-xs text-muted">
                          {r.source_type} ·{" "}
                          {r.source_metadata?.nutrition
                            ? `${r.source_metadata.nutrition.estimatedCaloriesPerServing ?? "?"} kcal · ${r.source_metadata.nutrition.confidence} ✓`
                            : `${r.calories_per_serving ?? "?"} kcal`}
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
