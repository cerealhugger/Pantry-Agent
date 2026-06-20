"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Recipe } from "@/lib/types";
import { foodEmoji } from "@/lib/food";

const SOURCE_LABEL: Record<string, { label: string; color: string }> = {
  youtube: { label: "YouTube", color: "bg-red-100 text-red-700" },
  web_recipe: { label: "Web", color: "bg-blue-100 text-blue-700" },
  xiaohongshu: { label: "小红书", color: "bg-pink-100 text-pink-600" },
  manual: { label: "Manual", color: "bg-brand-soft text-brand-dark" },
  seed: { label: "Example", color: "bg-black/5 text-muted" },
};

export default function RecipeBrowser({ recipes }: { recipes: Recipe[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return recipes;
    return recipes.filter(
      (r) =>
        r.title.toLowerCase().includes(s) ||
        (r.ingredients ?? []).some((ing) => (ing?.name ?? "").toLowerCase().includes(s)) ||
        (r.tags ?? []).some((t) => t.toLowerCase().includes(s))
    );
  }, [q, recipes]);

  const imported = filtered.filter((r) => r.source_type !== "seed");
  const seeded = filtered.filter((r) => r.source_type === "seed");

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search recipes or ingredients…"
        className="mb-5 w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
      />

      {filtered.length === 0 && <p className="text-sm text-muted">No recipes match “{q}”.</p>}

      {imported.length > 0 && (
        <section className="mb-7">
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">Saved &amp; imported</h2>
          <RecipeCards recipes={imported} />
        </section>
      )}

      {seeded.length > 0 && (
        <section>
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">Example recipes</h2>
          <RecipeCards recipes={seeded} />
        </section>
      )}
    </div>
  );
}

function RecipeCards({ recipes }: { recipes: Recipe[] }) {
  return (
    <ul className="space-y-2.5">
      {recipes.map((r) => {
        const src = SOURCE_LABEL[r.source_type] ?? SOURCE_LABEL.seed;
        return (
          <li key={r.id}>
            <Link
              href={`/recipes/${r.id}`}
              className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-3.5 py-3 shadow-sm transition active:scale-[0.99]"
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                {foodEmoji(r.title, null)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{r.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                  <span className={`rounded-full px-1.5 py-0.5 font-semibold ${src.color}`}>{src.label}</span>
                  {r.calories_per_serving != null && <span>{r.calories_per_serving} kcal</span>}
                  <span>· {(r.ingredients ?? []).length} ingredients</span>
                </div>
              </div>
              <span className="flex-shrink-0 text-muted">→</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
