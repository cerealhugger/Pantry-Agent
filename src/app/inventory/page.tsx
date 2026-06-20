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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Pantry Inventory</h1>
      <InventoryList items={items} />
    </main>
  );
}
