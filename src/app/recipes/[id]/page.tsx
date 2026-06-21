import { supabase } from "@/lib/supabase";
import type { Recipe, Ingredient } from "@/lib/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import DeleteRecipeButton from "./DeleteRecipeButton";
import NutritionSection from "./NutritionSection";

export const revalidate = 0;

async function getRecipe(id: string): Promise<Recipe | null> {
  const { data } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .single();
  return data ?? null;
}

export default async function RecipeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const recipe = await getRecipe(id);
  if (!recipe) notFound();

  const ingredients = (recipe.ingredients ?? []) as Ingredient[];
  const steps = (recipe.steps ?? []) as string[];
  const tags = (recipe.tags ?? []) as string[];
  const nutrition = recipe.source_metadata?.nutrition;
  const displayedCalories = nutrition?.estimatedCaloriesPerServing ?? recipe.calories_per_serving;
  const hasBrowserNutritionEvidence = Boolean(
    nutrition?.evidence.some((item) => item.status === "verified"),
  );

  return (
    <main className="px-5 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <Link href="/recipes" className="inline-block text-sm font-medium text-muted transition hover:text-ink">
          ← Recipes
        </Link>
        <DeleteRecipeButton id={recipe.id} />
      </div>

      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-3xl">
          🍽️
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight tracking-tight text-ink">{recipe.title}</h1>
          {displayedCalories != null && (
            <p className="mt-0.5 text-sm text-muted">
              {displayedCalories} estimated kcal · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
              {nutrition
                ? ` · ${nutrition.confidence} confidence · ${hasBrowserNutritionEvidence ? "browser evidence" : "AI fallback after browser search"}`
                : " · AI estimate"}
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

      {/* Ingredients */}
      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold text-ink/70">Ingredients</h2>
        <ul className="space-y-1.5">
          {ingredients.map((ing, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-xl border border-black/5 bg-white px-3.5 py-2.5 shadow-sm"
            >
              <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand" />
              <span className="flex-1 font-medium text-ink">{ing.name}</span>
              {ing.qty != null && (
                <span className="text-sm text-muted">
                  {ing.qty} {ing.unit}
                </span>
              )}
            </li>
          ))}
        </ul>
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

      <NutritionSection
        recipeId={recipe.id}
        aiCaloriesPerServing={recipe.calories_per_serving}
        saved={recipe.source_metadata?.nutrition ?? null}
      />

      {recipe.source_url && recipe.source_type !== "seed" && (
        <section className="mt-7 rounded-2xl border border-brand/15 bg-brand-soft p-4">
          <h2 className="mb-2 text-sm font-bold text-brand-dark">🌐 Imported via Browserbase</h2>
          <p className="text-xs text-brand-dark/80">Source: {recipe.source_type}</p>
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs font-semibold text-brand underline"
          >
            View original ↗
          </a>
        </section>
      )}
    </main>
  );
}
