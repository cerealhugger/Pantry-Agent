import { supabase } from "@/lib/supabase";
import type { Recipe, InventoryItem } from "@/lib/types";
import Planner from "@/components/Planner";

export const revalidate = 0;

export default async function PlannerPage() {
  const [recipesRes, inventoryRes] = await Promise.all([
    supabase.from("recipes").select("*").eq("user_id", "demo").order("created_at", { ascending: false }),
    supabase.from("inventory_items").select("*").eq("user_id", "demo").order("expiry_date", { ascending: true }),
  ]);

  // Build the next 7 days on the server so SSR and client render the same dates.
  const today = new Date();
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d.toISOString().split("T")[0];
  });

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Meal Plan</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Plan the week — we prioritize what&apos;s expiring and flag what you still need to buy.
      </p>
      <Planner
        recipes={(recipesRes.data ?? []) as Recipe[]}
        inventory={(inventoryRes.data ?? []) as InventoryItem[]}
        weekDates={weekDates}
      />
    </main>
  );
}
