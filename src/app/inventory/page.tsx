import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";
import InventoryList from "@/components/InventoryList";

export const revalidate = 0;

async function getInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("user_id", "demo")
    .order("expiry_date", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export default async function InventoryPage() {
  const items = await getInventory();

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Your Pantry</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Sorted by what expires first — cook these before they go.
      </p>
      <InventoryList items={items} />
    </main>
  );
}
