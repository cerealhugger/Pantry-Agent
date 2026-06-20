"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ShoppingListItem } from "@/lib/types";
import { foodEmoji } from "@/lib/food";

function amazonUrl(name: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(name + " grocery")}`;
}
function doordashUrl(name: string) {
  return `https://www.doordash.com/search/store/${encodeURIComponent(name)}/`;
}

export default function ShoppingList({ initialItems }: { initialItems: ShoppingListItem[] }) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems);
  const [draft, setDraft] = useState("");

  const toBuy = items.filter((i) => !i.checked);
  const bought = items.filter((i) => i.checked);

  async function addItem() {
    const name = draft.trim();
    if (!name) return;
    setDraft("");
    const { data } = await supabase
      .from("shopping_list_items")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({ user_id: "demo", name, quantity: null, unit: null, checked: false } as any)
      .select()
      .single();
    if (data) setItems((prev) => [data as ShoppingListItem, ...prev]);
  }

  // bought → auto-add to pantry
  async function buy(item: ShoppingListItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: true } : i)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shopping_list_items") as any).update({ checked: true }).eq("id", item.id);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    await supabase.from("inventory_items").insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        user_id: "demo",
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: null,
        purchase_date: new Date().toISOString().split("T")[0],
        expiry_date: expiry.toISOString().split("T")[0],
      } as any
    );
  }

  async function undo(item: ShoppingListItem) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, checked: false } : i)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shopping_list_items") as any).update({ checked: false }).eq("id", item.id);
  }

  async function remove(item: ShoppingListItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase.from("shopping_list_items").delete().eq("id", item.id);
  }

  return (
    <div>
      {/* add */}
      <div className="mb-5 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addItem()}
          placeholder="Add an item…"
          className="flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button
          onClick={addItem}
          disabled={!draft.trim()}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition active:scale-95 disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {items.length === 0 && (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-4xl">🛒</div>
          <p className="mt-4 font-semibold text-ink">Your list is empty</p>
          <p className="mt-1 text-sm text-muted">Plan meals and we&apos;ll add what you&apos;re missing.</p>
        </div>
      )}

      {/* to buy */}
      {toBuy.length > 0 && (
        <>
          <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-muted">To buy ({toBuy.length})</h2>
          <ul className="space-y-2.5">
            {toBuy.map((item) => (
              <li key={item.id} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => buy(item)}
                    aria-label="Mark as bought"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand/40 text-xs font-bold text-transparent transition hover:bg-brand-soft"
                  >
                    ✓
                  </button>
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-lg">
                    {foodEmoji(item.name, null)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.name}</p>
                    {item.quantity != null && (
                      <p className="text-xs text-muted">
                        {item.quantity} {item.unit}
                      </p>
                    )}
                  </div>
                  <button onClick={() => remove(item)} aria-label="Remove" className="px-1.5 text-muted transition hover:text-coral">
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex gap-2 pl-9">
                  <a
                    href={amazonUrl(item.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-amber/20 px-3 py-1 text-xs font-semibold text-[#a76a14]"
                  >
                    Amazon ↗
                  </a>
                  <a
                    href={doordashUrl(item.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-coral/15 px-3 py-1 text-xs font-semibold text-coral"
                  >
                    DoorDash ↗
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* bought → in pantry */}
      {bought.length > 0 && (
        <>
          <h2 className="mb-2.5 mt-6 text-xs font-bold uppercase tracking-wider text-muted">
            Bought · added to pantry ({bought.length})
          </h2>
          <ul className="space-y-2">
            {bought.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/60 px-3.5 py-2.5"
              >
                <button
                  onClick={() => undo(item)}
                  aria-label="Move back to buy"
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                >
                  ✓
                </button>
                <span className="flex-1 truncate font-medium text-muted line-through">{item.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
