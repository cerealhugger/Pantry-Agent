"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Recipe } from "@/lib/types";
import { mealEmoji } from "@/lib/food";
import Link from "next/link";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "bg-red-100 text-red-700" },
  web_recipe: { label: "Web", color: "bg-blue-100 text-blue-700" },
  xiaohongshu: { label: "小红书", color: "bg-pink-100 text-pink-600" },
  manual: { label: "Manual", color: "bg-brand-soft text-brand-dark" },
  seed: { label: "Example", color: "bg-black/5 text-muted" },
};

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase
      .from("recipes")
      .select("*")
      .eq("user_id", "demo")
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

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((r.ingredients as any[]) ?? []).some((ing) =>
          (ing?.name ?? "").toLowerCase().includes(s)
        ) ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ((r.tags as any[]) ?? []).some((t: string) =>
          (t ?? "").toLowerCase().includes(s)
        )
    );
  }, [q, recipes]);

  const imported = filtered.filter((r) => r.source_type !== "seed");
  const seeded = filtered.filter((r) => r.source_type === "seed");

  return (
    <main className="px-5 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Recipes</h1>
        <Link
          href="/import"
          className="rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-brand/25 transition active:scale-95"
        >
          + Import recipe
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search recipes or ingredients…"
        className="mb-5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
      />

      {filtered.length === 0 && (
        <p className="text-sm text-muted">
          {q ? `No recipes match “${q}”.` : "No recipes yet."}
        </p>
      )}

      {imported.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">
            Saved &amp; imported
          </h2>
          <RecipeCards recipes={imported} deleting={deleting} onDelete={handleDelete} />
        </section>
      )}

      {seeded.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">
            Example recipes
          </h2>
          <RecipeCards recipes={seeded} deleting={deleting} onDelete={handleDelete} />
        </section>
      )}
    </main>
  );
}

function RecipeCards({
  recipes,
  deleting,
  onDelete,
}: {
  recipes: Recipe[];
  deleting: string | null;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <ul className="space-y-2.5">
      {recipes.map((r) => {
        const src = SOURCE_LABEL[r.source_type] ?? SOURCE_LABEL.seed;
        const nutrition = r.source_metadata?.nutrition;
        const nutritionSource = nutrition?.evidence.find(
          (item) => item.status === "verified" && item.sourceUrl,
        )?.sourceUrl;
        let nutritionSourceHost: string | null = null;
        if (nutritionSource) {
          try {
            nutritionSourceHost = new URL(nutritionSource).hostname.replace(/^www\./, "");
          } catch {
            nutritionSourceHost = "browser source";
          }
        }
        return (
          <li key={r.id} className="group relative">
            <Link
              href={`/recipes/${r.id}`}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                {mealEmoji(r.title)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{r.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className={`rounded-full px-1.5 py-0.5 font-semibold ${src.color}`}>
                    {src.label}
                  </span>
                  {(nutrition?.estimatedCaloriesPerServing ?? r.calories_per_serving) != null && (
                    <span>
                      {nutrition?.estimatedCaloriesPerServing ?? r.calories_per_serving} kcal estimated
                    </span>
                  )}
                  <span>· {((r.ingredients as unknown[]) ?? []).length} ingredients</span>
                </div>
                {nutrition && (
                  <p className="mt-1 truncate text-[11px] font-medium text-emerald-700">
                    {nutrition.confidence} confidence · source: {nutritionSourceHost ?? "AI fallback after Browserbase search"}
                  </p>
                )}
              </div>
              <span className="flex-shrink-0 text-muted">→</span>
            </Link>

            {/* Delete button — appears on hover (kept from main) */}
            <button
              onClick={(e) => onDelete(r.id, e)}
              disabled={deleting === r.id}
              className="absolute right-12 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-coral opacity-0 transition-opacity hover:bg-coral/10 group-hover:opacity-100 disabled:opacity-40"
            >
              {deleting === r.id ? "…" : "Delete"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
