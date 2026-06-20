import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type MissingIngredient = {
  name: string;
  qty: number | null;
  unit: string | null;
  neededFor: string[]; // recipe titles
};

export async function POST(req: NextRequest) {
  const { items } = await req.json() as { items: MissingIngredient[] };
  if (!items?.length) return NextResponse.json({ error: "No items" }, { status: 400 });

  // Merge duplicates: if same ingredient needed for multiple recipes, combine neededFor
  const merged: Record<string, MissingIngredient> = {};
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (merged[key]) {
      merged[key].neededFor = [...new Set([...merged[key].neededFor, ...item.neededFor])];
    } else {
      merged[key] = { ...item };
    }
  }

  const rows = Object.values(merged).map((item) => ({
    user_id: "demo",
    name: item.name,
    quantity: item.qty,
    unit: item.unit,
    checked: false,
  }));

  const { error } = await supabase.from("shopping_list_items").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ added: rows.length });
}
