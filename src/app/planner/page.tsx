"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
import type { Recipe } from "@/lib/types";
import type { PlanEntry, MealSlot } from "@/app/api/planner/route";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MEALS = ["breakfast", "lunch", "dinner"] as const;

function getMonday(d = new Date()) {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.setDate(diff));
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function toISO(d: Date) {
  return d.toISOString().split("T")[0];
}

function nextWeekMonday() {
  const mon = getMonday();
  mon.setDate(mon.getDate() + 7);
  return mon;
}

type SlotKey = string; // "Monday-lunch"
type Plan = Record<SlotKey, PlanEntry & { locked: boolean }>;

export default function PlannerPage() {
  const weekStart = toISO(nextWeekMonday());
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<Plan>({});
  const [filling, setFilling] = useState(false);
  const [picker, setPicker] = useState<MealSlot | null>(null); // which slot is open
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from("recipes").select("*").eq("user_id", "demo")
      .order("source_type", { ascending: false })
      .then(({ data }) => setRecipes((data as Recipe[]) ?? []));

    // Load existing plan for next week
    supabase.from("meal_plans").select("*").eq("user_id", "demo").eq("week_start", weekStart).single()
      .then(({ data }) => {
        if (data?.plan) {
          const entries = data.plan as (PlanEntry & { locked?: boolean })[];
          const p: Plan = {};
          entries.forEach((e) => { p[`${e.day}-${e.meal}`] = { ...e, locked: e.locked ?? true }; });
          setPlan(p);
        }
      });
  }, [weekStart]);

  function slotEntry(day: string, meal: string) {
    return plan[`${day}-${meal}`] ?? null;
  }

  function handleManualSelect(recipe: Recipe) {
    if (!picker) return;
    const key = `${picker.day}-${picker.meal}`;
    setPlan((prev) => ({
      ...prev,
      [key]: {
        day: picker.day,
        meal: picker.meal as "breakfast" | "lunch" | "dinner",
        recipe_id: recipe.id,
        recipe_title: recipe.title,
        reason: "Manually selected",
        locked: true,
      },
    }));
    setPicker(null);
  }

  function handleClear(day: string, meal: string) {
    setPlan((prev) => {
      const next = { ...prev };
      delete next[`${day}-${meal}`];
      return next;
    });
  }

  async function handleAutoFill() {
    setFilling(true);
    setSaved(false);
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
      setSaved(true);
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

  const filledCount = Object.keys(plan).length;
  const totalSlots = DAYS.length * MEALS.length;

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Meal Planner</h1>
          <p className="text-sm text-gray-400 mt-0.5">Week of {weekStart} · {filledCount}/{totalSlots} slots filled</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAutoFill}
            disabled={filling}
            className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50"
          >
            {filling ? "AI filling…" : "✨ Auto-fill empty slots"}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:border-gray-400"
          >
            Save
          </button>
        </div>
      </div>

      {saved && (
        <p className="mb-4 text-sm text-green-600 font-medium">✓ Plan saved</p>
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
                <td className="py-2 pr-3 text-xs font-semibold text-gray-400 uppercase text-right align-top pt-3">
                  {meal}
                </td>
                {DAYS.map((day) => {
                  const entry = slotEntry(day, meal);
                  return (
                    <td key={day} className="p-1 align-top">
                      {entry ? (
                        <div className={`rounded-xl p-2.5 text-xs group relative min-h-[64px] ${entry.locked ? "bg-gray-900 text-white" : "bg-blue-50 border border-blue-200 text-blue-900"}`}>
                          <p className="font-semibold leading-snug">{entry.recipe_title}</p>
                          {!entry.locked && (
                            <p className="mt-1 text-blue-600 opacity-80 text-[10px] leading-tight">{entry.reason}</p>
                          )}
                          <button
                            onClick={() => handleClear(day, meal)}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400 transition-opacity text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPicker({ day, meal })}
                          className="w-full min-h-[64px] rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 text-gray-300 hover:text-gray-500 text-xl transition-colors"
                        >
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

      {/* Recipe picker modal */}
      {picker && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setPicker(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {picker.day} — {picker.meal}
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Pick a recipe</p>
            </div>
            <ul className="overflow-y-auto flex-1 divide-y divide-gray-50">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => handleManualSelect(r)}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <p className="font-medium text-sm text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r.source_type} · {r.calories_per_serving ?? "?"}kcal
                    </p>
                  </button>
                </li>
              ))}
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
