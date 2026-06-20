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

  const ingredients = recipe.ingredients as Ingredient[];
  const steps = recipe.steps as string[];
  const tags = recipe.tags as string[];

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <Link href="/recipes" className="text-sm text-gray-400 hover:text-gray-600">
          ← Back to Recipes
        </Link>
        <DeleteRecipeButton id={recipe.id} />
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">{recipe.title}</h1>

      <div className="flex flex-wrap items-center gap-2 mb-6 text-sm text-gray-500">
        {recipe.calories_per_serving && <span>{recipe.calories_per_serving} kcal · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}</span>}
        {tags.map((t) => (
          <span key={t} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">{t}</span>
        ))}
        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">
            Source ↗
          </a>
        )}
      </div>

      <section className="mb-6">
        <h2 className="font-semibold text-gray-800 mb-3">Ingredients</h2>
        <ul className="space-y-1">
          {ingredients.map((ing, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-gray-700">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 flex-shrink-0" />
              <span className="font-medium">{ing.name}</span>
              {ing.qty != null && <span className="text-gray-400">{ing.qty} {ing.unit}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold text-gray-800 mb-3">Steps</h2>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-900 text-white text-xs flex items-center justify-center font-semibold">
                {i + 1}
              </span>
              <span className="pt-0.5">{step}</span>
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
        <section className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm">
          <h2 className="font-semibold text-blue-900 mb-2">Imported via Browserbase</h2>
          <p className="text-blue-700 text-xs">Source: {recipe.source_type}</p>
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer"
            className="inline-block mt-2 text-xs text-blue-600 underline">
            View original ↗
          </a>
        </section>
      )}
    </main>
  );
}
