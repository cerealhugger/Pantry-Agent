"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Recipe } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  youtube:     { label: "YouTube",    color: "bg-red-100 text-red-700" },
  web_recipe:  { label: "Web Import", color: "bg-blue-100 text-blue-700" },
  xiaohongshu: { label: "小红书",      color: "bg-pink-100 text-pink-700" },
  manual:      { label: "Manual",     color: "bg-purple-100 text-purple-700" },
  seed:        { label: "Example",    color: "bg-gray-100 text-gray-500" },
};

export default function RecipesPage() {
  const router = useRouter();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("recipes").select("*").eq("user_id", "demo")
      .order("created_at", { ascending: false })
      .then(({ data }: { data: Recipe[] | null }) => setRecipes(data ?? []));
  }, []);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this recipe?")) return;
    setDeleting(id);
    await supabase.from("recipes").delete().eq("id", id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
    setDeleting(null);
  }

  const imported = recipes.filter((r) => r.source_type !== "seed");
  const seeded   = recipes.filter((r) => r.source_type === "seed");

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Recipes</h1>
        <Link href="/import"
          className="px-4 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700 transition-colors">
          + Import from URL
        </Link>
      </div>

      {imported.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Your Saved Recipes</h2>
          <RecipeList recipes={imported} deleting={deleting} onDelete={handleDelete} />
        </section>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Example Recipes</h2>
        <RecipeList recipes={seeded} deleting={deleting} onDelete={handleDelete} />
      </section>
    </main>
  );
}

function RecipeList({
  recipes,
  deleting,
  onDelete,
}: {
  recipes: Recipe[];
  deleting: string | null;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  if (recipes.length === 0) return <p className="text-sm text-gray-400">None yet.</p>;

  return (
    <ul className="space-y-3">
      {recipes.map((r) => {
        const src = SOURCE_LABEL[r.source_type] ?? SOURCE_LABEL.seed;
        return (
          <li key={r.id} className="group relative">
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

            {/* Delete button — appears on hover */}
            <button
              onClick={(e) => onDelete(r.id, e)}
              disabled={deleting === r.id}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 rounded-lg text-xs text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              {deleting === r.id ? "…" : "Delete"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
