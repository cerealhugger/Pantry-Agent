import { supabase } from "@/lib/supabase";
import type { Recipe } from "@/lib/types";
import Link from "next/link";
import RecipeBrowser from "@/components/RecipeBrowser";

export const revalidate = 0;

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

  return (
    <main className="px-5 pt-5">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Recipes</h1>
        <Link
          href="/import"
          className="rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm shadow-brand/25 transition active:scale-95"
        >
          + Import
        </Link>
      </div>
      <RecipeBrowser recipes={recipes} />
    </main>
  );
}
