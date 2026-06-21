"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { ShoppingListItem } from "@/lib/types";
import { foodEmoji } from "@/lib/food";

function amazonUrl(name: string) {
  return `https://www.amazon.com/s?k=${encodeURIComponent(name + " grocery")}`;
}
function doordashUrl(name: string) {
  return `https://www.doordash.com/search/store/${encodeURIComponent(name)}/`;
}

const todayStr = () => new Date().toISOString().split("T")[0];

// One display row per ingredient (name + unit), summing quantities. Each group
// remembers the underlying row ids so buy/undo/remove act on the whole group.
type Group = {
  key: string;
  name: string;
  unit: string | null;
  quantity: number | null;
  ids: string[];
};

function groupItems(items: ShoppingListItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = `${it.name.toLowerCase().trim()}|${it.unit ?? ""}`;
    const g = map.get(key);
    if (!g) {
      map.set(key, { key, name: it.name, unit: it.unit, quantity: it.quantity, ids: [it.id] });
    } else {
      g.ids.push(it.id);
      if (g.quantity != null && it.quantity != null) {
        g.quantity = Number(g.quantity) + Number(it.quantity);
      } else if (g.quantity == null) {
        g.quantity = it.quantity;
      }
    }
  }
  return Array.from(map.values());
}

export default function ShoppingList({ initialItems }: { initialItems: ShoppingListItem[] }) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems);
  const [draft, setDraft] = useState("");

  const toBuy = useMemo(() => groupItems(items.filter((i) => !i.checked)), [items]);
  const bought = useMemo(() => groupItems(items.filter((i) => i.checked)), [items]);

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

  // bought → mark the whole group checked + add ONE merged row to the pantry
  async function buy(group: Group) {
    setItems((prev) => prev.map((i) => (group.ids.includes(i.id) ? { ...i, checked: true } : i)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shopping_list_items") as any).update({ checked: true }).in("id", group.ids);

    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 7);
    await supabase.from("inventory_items").insert(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {
        user_id: "demo",
        name: group.name,
        quantity: group.quantity,
        unit: group.unit,
        category: null,
        purchase_date: todayStr(),
        expiry_date: expiry.toISOString().split("T")[0],
      } as any
    );
  }

  async function undo(group: Group) {
    setItems((prev) => prev.map((i) => (group.ids.includes(i.id) ? { ...i, checked: false } : i)));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("shopping_list_items") as any).update({ checked: false }).in("id", group.ids);
  }

  async function remove(group: Group) {
    setItems((prev) => prev.filter((i) => !group.ids.includes(i.id)));
    await supabase.from("shopping_list_items").delete().in("id", group.ids);
  }

  const qtyLabel = (g: Group) =>
    g.quantity != null ? `${g.quantity} ${g.unit ?? ""}`.trim() : null;

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
            {toBuy.map((group) => (
              <li key={group.key} className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => buy(group)}
                    aria-label="Mark as bought"
                    className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-brand/40 text-xs font-bold text-transparent transition hover:bg-brand-soft"
                  >
                    ✓
                  </button>
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-soft text-lg">
                    {foodEmoji(group.name, null)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{group.name}</p>
                    {qtyLabel(group) && <p className="text-xs text-muted">{qtyLabel(group)}</p>}
                  </div>
                  <button onClick={() => remove(group)} aria-label="Remove" className="px-1.5 text-muted transition hover:text-coral">
                    ✕
                  </button>
                </div>
                <div className="mt-2 flex gap-2 pl-9">
                  <a
                    href={amazonUrl(group.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full bg-amber/20 px-3 py-1 text-xs font-semibold text-[#a76a14]"
                  >
                    Amazon ↗
                  </a>
                  <a
                    href={doordashUrl(group.name)}
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
            {bought.map((group) => (
              <li
                key={group.key}
                className="flex items-center gap-3 rounded-2xl border border-black/5 bg-white/60 px-3.5 py-2.5"
              >
                <button
                  onClick={() => undo(group)}
                  aria-label="Move back to buy"
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white"
                >
                  ✓
                </button>
                <span className="flex-1 truncate font-medium text-muted line-through">{group.name}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
