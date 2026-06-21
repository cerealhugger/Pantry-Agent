import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, Recipe } from "@/lib/types";
import InventoryList from "@/components/InventoryList";
import { recommend } from "@/lib/match";
import { foodEmoji } from "@/lib/food";

export const revalidate = 0;

async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", "demo")
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

async function getRecipes(): Promise<Recipe[]> {
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", "demo");
  return (data ?? []) as Recipe[];
}

export default async function InventoryPage() {
  const [items, recipes] = await Promise.all([getInventory(), getRecipes()]);

  // Quick local heuristic: recipes that use up soon-to-expire items first.
  // Coexists with the AI planner (/planner) — this is the instant, zero-cost
  // "what can I cook right now" shortcut.
  const recs = recommend(recipes, items).slice(0, 3);

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Your Pantry</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Sorted by what expires first — cook these before they go.
      </p>

      <InventoryList items={items} />

      {recs.length > 0 && (
        <section className="mt-7">
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink/70">Recommended recipes</h2>
            <Link href="/planner" className="text-xs font-bold text-brand">
              Plan →
            </Link>
          </div>
          <ul className="space-y-2.5">
            {recs.map(({ recipe, cov }) => (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm transition active:scale-[0.99]"
                >
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                    {foodEmoji(recipe.title, null)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{recipe.title}</p>
                    <p className="mt-0.5 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${
                        cov.expiringUsed > 0
                          ? "bg-amber/25 text-[#a76a14]"
                          : "bg-brand-soft text-brand-dark"
                      }`}>
                        {cov.expiringUsed > 0
                          ? `uses ${cov.expiringUsed} expiring`
                          : `${Math.round(cov.ratio * 100)}% pantry match`}
                      </span>
                    </p>
                  </div>
                  <span className="flex-shrink-0 text-muted">→</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/planner"
            className="mt-3 flex items-center justify-center rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-sm shadow-brand/25 transition active:scale-[0.99]"
          >
            Plan your meals →
          </Link>
        </section>
      )}
    </main>
  );
}
