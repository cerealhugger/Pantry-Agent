"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Recipe, InventoryItem } from "@/lib/types";
import { coverage, recommend } from "@/lib/match";
import { foodEmoji } from "@/lib/food";

type PlannedMeal = { id: string; title: string; recipeId: string | null };
type Plan = Record<string, PlannedMeal[]>;

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STORAGE_KEY = "pantry-agent-plan";

function fmtDay(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { wd: WEEKDAY[d.getDay()], day: d.getDate() };
}

export default function Planner({
  recipes,
  inventory,
  weekDates,
}: {
  recipes: Recipe[];
  inventory: InventoryItem[];
  weekDates: string[];
}) {
  const [selected, setSelected] = useState(weekDates[0]);
  const [plan, setPlan] = useState<Plan>({});
  const [draft, setDraft] = useState("");
  const [addedMsg, setAddedMsg] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setPlan(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {}
  }, [plan]);

  const dayMeals = plan[selected] ?? [];

  function addMeal(title: string, recipeId: string | null) {
    if (!title.trim()) return;
    const meal: PlannedMeal = { id: `${Date.now()}-${Math.random()}`, title: title.trim(), recipeId };
    setPlan((p) => ({ ...p, [selected]: [...(p[selected] ?? []), meal] }));
  }

  function removeMeal(id: string) {
    setPlan((p) => ({ ...p, [selected]: (p[selected] ?? []).filter((m) => m.id !== id) }));
  }

  const recs = useMemo(() => recommend(recipes, inventory).slice(0, 4), [recipes, inventory]);

  // Missing ingredients across the day's recipe-backed meals.
  const missing = useMemo(() => {
    const set = new Set<string>();
    for (const m of dayMeals) {
      if (!m.recipeId) continue;
      const r = recipes.find((x) => x.id === m.recipeId);
      if (!r) continue;
      for (const name of coverage(r, inventory).missing) set.add(name);
    }
    return [...set];
  }, [dayMeals, recipes, inventory]);

  async function addToShoppingList() {
    if (missing.length === 0) return;
    const rows = missing.map((name) => ({ user_id: "demo", name, quantity: null, unit: null, checked: false }));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from("shopping_list_items").insert(rows as any);
    setAddedMsg(`Added ${missing.length} item${missing.length !== 1 ? "s" : ""} to your shopping list`);
    setTimeout(() => setAddedMsg(null), 2500);
  }

  return (
    <div>
      {/* week strip */}
      <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {weekDates.map((iso, i) => {
          const { wd, day } = fmtDay(iso);
          const active = iso === selected;
          const count = (plan[iso] ?? []).length;
          return (
            <button
              key={iso}
              onClick={() => setSelected(iso)}
              className={`flex min-w-[3.1rem] flex-col items-center rounded-2xl px-2 py-2.5 transition ${
                active ? "bg-brand text-white shadow-md shadow-brand/25" : "bg-white text-ink shadow-sm"
              }`}
            >
              <span className={`text-[10px] font-semibold ${active ? "text-white/80" : "text-muted"}`}>
                {i === 0 ? "Today" : wd}
              </span>
              <span className="text-lg font-bold leading-tight">{day}</span>
              <span
                className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
                  count > 0 ? (active ? "bg-white" : "bg-brand") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* planned meals */}
      <h2 className="mb-2 mt-6 text-sm font-bold text-ink/70">Planned meals</h2>
      {dayMeals.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-black/10 bg-white/60 px-4 py-5 text-center text-sm text-muted">
          Nothing planned yet. Add a dish, or pick a suggestion below.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {dayMeals.map((m) => {
            const r = m.recipeId ? recipes.find((x) => x.id === m.recipeId) : null;
            const cov = r ? coverage(r, inventory) : null;
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm"
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-xl">
                  {foodEmoji(m.title, null)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{m.title}</p>
                  {cov ? (
                    cov.missing.length === 0 ? (
                      <p className="text-xs font-medium text-brand">✓ You have everything</p>
                    ) : (
                      <p className="truncate text-xs text-coral">Need: {cov.missing.join(", ")}</p>
                    )
                  ) : (
                    <p className="text-xs text-muted">Custom meal</p>
                  )}
                </div>
                <button
                  onClick={() => removeMeal(m.id)}
                  aria-label="Remove"
                  className="flex-shrink-0 rounded-full px-2 py-1 text-muted transition hover:text-coral"
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* shopping needed */}
      {missing.length > 0 && (
        <div className="mt-3 rounded-2xl border border-coral/20 bg-coral/10 p-4">
          <p className="text-sm font-bold text-ink">🛒 Need to buy ({missing.length})</p>
          <p className="mt-1 text-xs text-muted">{missing.join(" · ")}</p>
          <button
            onClick={addToShoppingList}
            className="mt-3 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.99]"
          >
            Add to shopping list
          </button>
          {addedMsg && <p className="mt-2 text-center text-xs font-medium text-brand">{addedMsg}</p>}
        </div>
      )}

      {/* add custom */}
      <h2 className="mb-2 mt-6 text-sm font-bold text-ink/70">Add what you want to eat</h2>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              addMeal(draft, null);
              setDraft("");
            }
          }}
          placeholder="e.g. dumplings, ramen…"
          className="flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button
          onClick={() => {
            addMeal(draft, null);
            setDraft("");
          }}
          disabled={!draft.trim()}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {/* recommendations */}
      <h2 className="mb-2 mt-7 text-sm font-bold text-ink/70">
        Cook what&apos;s expiring <span className="font-normal text-muted">· from your pantry</span>
      </h2>
      {recs.length === 0 ? (
        <p className="text-sm text-muted">No recipes yet — import or add some first.</p>
      ) : (
        <ul className="space-y-2.5">
          {recs.map(({ recipe, cov }) => (
            <li
              key={recipe.id}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                {foodEmoji(recipe.title, null)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{recipe.title}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                  {cov.expiringUsed > 0 && (
                    <span className="rounded-full bg-amber/25 px-2 py-0.5 font-semibold text-[#a76a14]">
                      uses {cov.expiringUsed} expiring
                    </span>
                  )}
                  {cov.missing.length === 0 ? (
                    <span className="font-medium text-brand">✓ ready to cook</span>
                  ) : (
                    <span className="text-muted">need {cov.missing.length} more</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => addMeal(recipe.title, recipe.id)}
                className="flex-shrink-0 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand-dark transition active:scale-95"
              >
                + Add
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
