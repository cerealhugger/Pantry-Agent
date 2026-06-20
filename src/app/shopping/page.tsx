import { supabase } from "@/lib/supabase";
import type { ShoppingListItem as Item } from "@/lib/types";
import ShoppingList from "@/components/ShoppingList";

export const revalidate = 0;

export default async function ShoppingPage() {
  const { data } = await supabase
    .from("shopping_list_items")
    .select("*")
    .eq("user_id", "demo")
    .order("created_at", { ascending: false });

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Shopping List</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Check items off as you buy — they drop straight into your pantry.
      </p>
      <ShoppingList initialItems={(data ?? []) as Item[]} />
    </main>
  );
}
