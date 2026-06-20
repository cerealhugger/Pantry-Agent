import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/lib/types";
import Link from "next/link";

export const revalidate = 0;

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  youtube:     { label: "YouTube",      color: "bg-red-100 text-red-700" },
  web_recipe:  { label: "Web Import",   color: "bg-blue-100 text-blue-700" },
  xiaohongshu: { label: "小红书",        color: "bg-pink-100 text-pink-700" },
  manual:      { label: "Manual",       color: "bg-purple-100 text-purple-700" },
  seed:        { label: "Example",      color: "bg-gray-100 text-gray-500" },
};

async function getRecipes(): Promise<Recipe[]> {
  const { data, error } = await supabase
    .from("recipes")
    .select("*")
    .eq("user_id", "demo")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function RecipesPage() {
  const recipes = await getRecipes();

  const imported = recipes.filter((r) => r.source_type !== "seed");
  const seeded   = recipes.filter((r) => r.source_type === "seed");

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <Link
          href="/import"
          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors"
        >
          + Import from URL
        </Link>
      </div>

      {imported.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Your Saved Recipes
          </h2>
          <RecipeList recipes={imported} />
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Example Recipes
        </h2>
        <RecipeList recipes={seeded} />
      </section>
    </main>
  );
}

function RecipeList({ recipes }: { recipes: Recipe[] }) {
  return (
    <ul className="space-y-3">
      {recipes.map((r) => {
        const src = SOURCE_LABEL[r.source_type] ?? SOURCE_LABEL.seed;
        return (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3 hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${src.color}`}>
                  {src.label}
                </span>
                <span className="font-medium text-gray-900">{r.title}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-400">
                {r.calories_per_serving && <span>{r.calories_per_serving} kcal</span>}
                <span>{(r.ingredients as unknown[]).length} ingredients</span>
                <span>→</span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
