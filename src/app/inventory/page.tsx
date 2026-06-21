import Link from "next/link";
import { supabase } from "@/lib/supabase";
import type { InventoryItem, Recipe } from "@/lib/types";
import InventoryList from "@/components/InventoryList";
import { recommend } from "@/lib/match";
import { mealEmoji } from "@/lib/food";

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

  // Recommend meals from what's already in the pantry: recipes that use up
  // soon-to-expire items rank first, then best ingredient coverage. Always show
  // the top picks (not only when something is expiring).
  const recs = recommend(recipes, items).slice(0, 3);

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Your Pantry</h1>

      {/* Recommended meals from what you already have — at the top of the page */}
      <section className="mb-7 mt-3">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink">Recommended for you</h2>
          <Link href="/recipes" className="text-xs font-bold text-brand">
            Browse all →
          </Link>
        </div>
        <p className="mb-3 text-xs text-muted">
          Based on what&apos;s in your pantry right now.
        </p>

        {recs.length > 0 ? (
          <ul className="space-y-2.5">
            {recs.map(({ recipe, cov }) => {
              const total = cov.have.length + cov.missing.length;
              return (
                <li key={recipe.id}>
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm transition active:scale-[0.99]"
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                      {mealEmoji(recipe.title)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{recipe.title}</p>
                      <p className="mt-0.5 text-xs">
                        {cov.expiringUsed > 0 ? (
                          <span className="rounded-full bg-amber/25 px-2 py-0.5 font-semibold text-[#a76a14]">
                            uses {cov.expiringUsed} expiring
                          </span>
                        ) : cov.missing.length === 0 ? (
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand-dark">
                            ✓ ready to cook
                          </span>
                        ) : (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 font-semibold text-muted">
                            have {cov.have.length}/{total} ingredients
                          </span>
                        )}
                      </p>
                    </div>
                    <span className="flex-shrink-0 text-muted">→</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-black/15 bg-white/50 px-4 py-6 text-center">
            <p className="text-sm font-medium text-muted">No recipes yet to recommend.</p>
            <Link href="/import" className="mt-1 inline-block text-xs font-bold text-brand">
              Import a recipe →
            </Link>
          </div>
        )}

        {/* Two ways to start: plan straight away, or pick a recipe first */}
        <div className="mt-4 space-y-2">
          <Link
            href="/planner"
            className="flex items-center justify-center gap-1.5 rounded-2xl bg-brand py-3 text-sm font-bold text-white shadow-sm shadow-brand/25 transition active:scale-[0.99]"
          >
            🍳 Start cooking — go to Meal Plan →
          </Link>
          <Link
            href="/recipes"
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-brand/25 bg-brand-soft py-3 text-sm font-bold text-brand-dark transition active:scale-[0.99]"
          >
            📖 Pick what you want to eat →
          </Link>
        </div>
      </section>

      <p className="mb-4 text-sm text-muted">
        Sorted by what expires first — cook these before they go.
      </p>
      <InventoryList items={items} />
    </main>
  );
}
