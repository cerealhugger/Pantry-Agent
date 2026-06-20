import { supabase } from "@/lib/supabase";
import type { Recipe, Ingredient, InventoryItem } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { foodEmoji } from "@/lib/food";
import { inStock } from "@/lib/match";

export const revalidate = 0;

async function getData(id: string): Promise<{ recipe: Recipe | null; inventory: InventoryItem[] }> {
  const [recipeRes, invRes] = await Promise.all([
    supabase.from("recipes").select("*").eq("id", id).single(),
    supabase.from("inventory_items").select("*").eq("user_id", "demo"),
  ]);
  return { recipe: recipeRes.data ?? null, inventory: invRes.data ?? [] };
}

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { recipe, inventory } = await getData(id);
  if (!recipe) notFound();

  const ingredients = (recipe.ingredients ?? []) as Ingredient[];
  const steps = (recipe.steps ?? []) as string[];
  const tags = (recipe.tags ?? []) as string[];

  return (
    <main className="px-5 pt-5">
      <Link href="/recipes" className="mb-3 inline-block text-sm font-medium text-muted transition hover:text-ink">
        ← Recipes
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl">
          {foodEmoji(recipe.title, null)}
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">{recipe.title}</h1>
          {recipe.calories_per_serving != null && (
            <p className="mt-0.5 text-sm text-muted">
              {recipe.calories_per_serving} kcal · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {(tags.length > 0 || recipe.source_url) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-muted">
              {t}
            </span>
          ))}
          {recipe.source_url && (
            <a
              href={recipe.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-dark"
            >
              Source ↗
            </a>
          )}
        </div>
      )}

      {/* Ingredients with live pantry status */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink/70">Ingredients</h2>
        <ul className="space-y-1.5">
          {ingredients.map((ing, i) => {
            const have = inStock(ing.name, inventory);
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3.5 py-2.5 shadow-sm"
              >
                <span
                  className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    have ? "bg-brand-soft text-brand" : "bg-coral/15 text-coral"
                  }`}
                >
                  {have ? "✓" : "+"}
                </span>
                <span className="flex-1 font-medium text-ink">{ing.name}</span>
                {ing.qty != null && (
                  <span className="text-sm text-muted">
                    {ing.qty} {ing.unit}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-muted">
          <span className="font-semibold text-brand">✓</span> in your pantry ·{" "}
          <span className="font-semibold text-coral">+</span> need to buy
        </p>
      </section>

      {/* Steps */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink/70">Steps</h2>
        <ol className="space-y-2.5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5 text-sm text-ink">{step}</span>
            </li>
          ))}
        </ol>
      </section>

      {recipe.browserbase_session_id && (
        <section className="mt-7 rounded-2xl border border-brand/15 bg-brand-soft p-4">
          <h2 className="mb-2 text-sm font-bold text-brand-dark">🌐 Imported via Browserbase</h2>
          <p className="text-xs text-brand-dark/80">Mode: {recipe.extraction_mode}</p>
          <p className="truncate text-xs text-brand-dark/80">Session: {recipe.browserbase_session_id}</p>
          {recipe.browserbase_replay_url && (
            <a
              href={recipe.browserbase_replay_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-xs font-semibold text-brand underline"
            >
              View session replay ↗
            </a>
          )}
        </section>
      )}
    </main>
  );
}
