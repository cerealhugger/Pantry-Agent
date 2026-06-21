"use client";

import { useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";
import { foodEmoji } from "@/lib/food";

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryStyle(days: number | null) {
  if (days === null)
    return { chip: "bg-black/5 text-muted", label: "No date", accent: "border-l-transparent" };
  if (days <= 0)
    return { chip: "bg-coral/15 text-coral", label: "Expired", accent: "border-l-coral" };
  if (days <= 2)
    return { chip: "bg-coral/15 text-coral", label: `${days}d left`, accent: "border-l-coral" };
  if (days <= 5)
    return { chip: "bg-amber/25 text-[#a76a14]", label: `${days}d left`, accent: "border-l-amber" };
  return { chip: "bg-brand-soft text-brand-dark", label: `${days}d`, accent: "border-l-transparent" };
}

function categoryEmoji(category: string | null): string {
  switch (category) {
    case "vegetable": return "🥬";
    case "fruit":     return "🍎";
    case "meat":      return "🍖";
    case "seafood":   return "🦐";
    case "dairy":     return "🧀";
    case "pantry":    return "🫙"; // legacy seed data
    case "others":    return "🛒";
    default:          return "🍽️";
  }
}

const CATEGORIES = ["vegetable", "fruit", "meat", "seafood", "dairy", "others"];
const MAIN_CATEGORIES = ["vegetable", "fruit", "meat", "seafood", "dairy"];

// Tab matching: "all" matches everything, "others" catches anything not in the
// five main categories (incl. null / legacy "pantry"), the rest match exactly.
function inCategory(item: InventoryItem, cat: string): boolean {
  if (cat === "all") return true;
  const c = (item.category ?? "").toLowerCase();
  if (cat === "others") return !MAIN_CATEGORIES.includes(c);
  return c === cat;
}

// Quantity/unit rule for pantry items: if neither is specified default to 1 pcs;
// a provided quantity must be positive. Returns null when the quantity is invalid
// (caller should reject the save).
function normalizeQtyUnit(
  qtyText: string,
  unitText: string
): { quantity: number | null; unit: string | null } | null {
  let quantity: number | null = qtyText.trim() ? Number(qtyText) : null;
  let unit: string | null = unitText.trim() || null;
  if (quantity != null && (!isFinite(quantity) || quantity <= 0)) return null; // must be positive
  if (quantity == null && unit == null) {
    quantity = 1;
    unit = "pcs";
  }
  return { quantity, unit };
}

// is a typed quantity present but not a positive number?
const qtyIsInvalid = (qtyText: string) =>
  qtyText.trim() !== "" && !(Number(qtyText) > 0);

const todayStr = () => new Date().toISOString().split("T")[0];

function addedLabel(purchaseDate: string | null): string | null {
  if (!purchaseDate) return null;
  if (purchaseDate === todayStr()) return "added today";
  const d = new Date(purchaseDate);
  return `added ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
}

// Stable grouping key for "merge same items" (name + unit, case-insensitive).
// Reused so the edit/remove flow can find every underlying row of a merged item.
const mergeKey = (it: { name: string | null; unit: string | null }) =>
  `${(it.name ?? "").toLowerCase().trim()}|${it.unit ?? ""}`;

// Merge same items: group by name + unit, sum quantities, keep the soonest
// expiry (most urgent) and the latest purchase date (most recent restock).
function mergeItems(items: InventoryItem[]): InventoryItem[] {
  const map = new Map<string, InventoryItem>();
  for (const it of items) {
    const key = mergeKey(it);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...it });
      continue;
    }
    if (existing.quantity != null && it.quantity != null) {
      existing.quantity = Number(existing.quantity) + Number(it.quantity);
    } else if (existing.quantity == null) {
      existing.quantity = it.quantity;
    }
    if (it.expiry_date && (!existing.expiry_date || it.expiry_date < existing.expiry_date)) {
      existing.expiry_date = it.expiry_date;
    }
    if (it.purchase_date && (!existing.purchase_date || it.purchase_date > existing.purchase_date)) {
      existing.purchase_date = it.purchase_date;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const da = a.expiry_date ?? "9999";
    const db = b.expiry_date ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });
}

export default function InventoryList({ items }: { items: InventoryItem[] }) {
  const [localItems, setLocalItems] = useState<InventoryItem[]>(items);
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("all");

  // manual add-ingredient form
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("");
  const [expiryDays, setExpiryDays] = useState("");
  const [saving, setSaving] = useState(false);

  // edit-an-existing-item form. editKey = the merged group key (name|unit).
  const [editKey, setEditKey] = useState<string | null>(null);
  const [eName, setEName] = useState("");
  const [eQty, setEQty] = useState("");
  const [eUnit, setEUnit] = useState("");
  const [eCategory, setECategory] = useState("");
  const [eExpiry, setEExpiry] = useState(""); // yyyy-mm-dd or ""
  const [eSaving, setESaving] = useState(false);

  const merged = useMemo(() => mergeItems(localItems), [localItems]);

  function startEdit(item: InventoryItem) {
    setEditKey(mergeKey(item));
    setEName(item.name);
    setEQty(item.quantity != null ? String(item.quantity) : "");
    setEUnit(item.unit ?? "");
    setECategory(item.category ?? "");
    setEExpiry(item.expiry_date ?? "");
  }

  function cancelEdit() {
    setEditKey(null);
  }

  // Save edits to a merged item: a merged row can be backed by several DB rows,
  // so replace the whole group with one consolidated row.
  async function saveEdit(origKey: string, purchaseDate: string | null) {
    const n = eName.trim();
    if (!n || eSaving) return;
    const qu = normalizeQtyUnit(eQty, eUnit);
    if (!qu) return; // quantity must be positive
    setESaving(true);

    const ids = localItems.filter((it) => mergeKey(it) === origKey).map((it) => it.id);

    const row = {
      user_id: "demo",
      name: n,
      quantity: qu.quantity,
      unit: qu.unit,
      category: eCategory || null,
      purchase_date: purchaseDate ?? todayStr(),
      expiry_date: eExpiry || null,
    };

    if (ids.length) await supabase.from("inventory_items").delete().in("id", ids);
    const { data } = await supabase
      .from("inventory_items")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(row as any)
      .select()
      .single();

    setLocalItems((prev) => {
      const rest = prev.filter((it) => !ids.includes(it.id));
      return data ? [...rest, data as InventoryItem] : rest;
    });
    setEditKey(null);
    setESaving(false);
  }

  async function removeItem(origKey: string) {
    const ids = localItems.filter((it) => mergeKey(it) === origKey).map((it) => it.id);
    setLocalItems((prev) => prev.filter((it) => !ids.includes(it.id)));
    setEditKey(null);
    if (ids.length) await supabase.from("inventory_items").delete().in("id", ids);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((i) => {
      if (!inCategory(i, activeCat)) return false;
      if (!q) return true;
      return (
        i.name.toLowerCase().includes(q) ||
        (i.category ?? "").toLowerCase().includes(q)
      );
    });
  }, [merged, query, activeCat]);

  async function handleAdd() {
    const n = name.trim();
    if (!n || saving) return;
    const qu = normalizeQtyUnit(qty, unit);
    if (!qu) return; // quantity must be positive
    setSaving(true);

    let expiry: string | null = null;
    const days = parseInt(expiryDays, 10);
    if (!isNaN(days)) {
      const d = new Date();
      d.setDate(d.getDate() + days);
      expiry = d.toISOString().split("T")[0];
    }

    const row = {
      user_id: "demo",
      name: n,
      quantity: qu.quantity,
      unit: qu.unit,
      category: category || null,
      purchase_date: todayStr(),
      expiry_date: expiry,
    };

    const { data } = await supabase
      .from("inventory_items")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(row as any)
      .select()
      .single();

    if (data) setLocalItems((prev) => [...prev, data as InventoryItem]);
    setName("");
    setCategory("");
    setQty("");
    setUnit("");
    setExpiryDays("");
    setShowAdd(false);
    setSaving(false);
  }

  const soon = merged.filter((i) => {
    const d = daysUntilExpiry(i.expiry_date);
    return d !== null && d <= 2;
  }).length;

  return (
    <div>
      {/* search */}
      <div className="relative mb-3">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your pantry…"
          className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-10 pr-9 text-sm text-ink focus:border-brand focus:outline-none"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted transition hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      {/* manual add ingredient */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-brand/40 bg-brand-soft/50 py-2.5 text-sm font-bold text-brand-dark transition active:scale-[0.99]"
        >
          ＋ Add an ingredient
        </button>
      ) : (
        <div className="mb-5 rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Ingredient name"
            autoFocus
            className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              type="number"
              inputMode="decimal"
              min="0"
              placeholder="Qty"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit (g, pcs…)"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            >
              <option value="">Category…</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryEmoji(c)} {c}
                </option>
              ))}
            </select>
            <input
              value={expiryDays}
              onChange={(e) => setExpiryDays(e.target.value)}
              type="number"
              inputMode="numeric"
              placeholder="Expires in (days)"
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
            />
          </div>
          {qtyIsInvalid(qty) && (
            <p className="mt-2 text-xs font-semibold text-coral">Quantity must be greater than 0.</p>
          )}
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!name.trim() || saving || qtyIsInvalid(qty)}
              className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
            >
              {saving ? "Adding…" : "Add to pantry"}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-muted transition active:scale-[0.99]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {localItems.length === 0 ? (
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-4xl">🧺</div>
          <p className="mt-4 font-semibold text-ink">Your pantry is empty</p>
          <p className="mt-1 text-sm text-muted">Scan a receipt or add an ingredient above.</p>
        </div>
      ) : (
        <>
          {/* category tabs — filter by category, still sorted by expiry within it */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
            {["all", ...CATEGORIES].map((cat) => {
              const count =
                cat === "all" ? merged.length : merged.filter((i) => inCategory(i, cat)).length;
              const active = activeCat === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCat(cat)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition active:scale-95 ${
                    active ? "bg-brand text-white shadow-sm shadow-brand/25" : "bg-white text-muted shadow-sm"
                  }`}
                >
                  {cat === "all" ? "All" : `${categoryEmoji(cat)} ${cat}`} ({count})
                </button>
              );
            })}
          </div>

          {soon > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-coral/15 px-3 py-1 text-xs font-semibold text-coral">
                ⚠️ {soon} expiring soon
              </span>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-black/15 bg-white/50 px-4 py-6 text-center text-sm text-muted">
              {query
                ? `No items match “${query}”.`
                : "No items in this category."}
            </p>
          ) : (
            <ul className="space-y-2.5">
              {filtered.map((item) => {
                const key = mergeKey(item);
                const days = daysUntilExpiry(item.expiry_date);
                const s = expiryStyle(days);
                const added = addedLabel(item.purchase_date);

                if (editKey === key) {
                  return (
                    <li
                      key={key}
                      className="rounded-2xl border border-brand/30 bg-white p-3.5 shadow-sm"
                    >
                      <input
                        value={eName}
                        onChange={(e) => setEName(e.target.value)}
                        placeholder="Ingredient name"
                        autoFocus
                        className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-brand focus:outline-none"
                      />
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <input
                          value={eQty}
                          onChange={(e) => setEQty(e.target.value)}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          placeholder="Qty"
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                        />
                        <input
                          value={eUnit}
                          onChange={(e) => setEUnit(e.target.value)}
                          placeholder="Unit (g, pcs…)"
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                        />
                        <select
                          value={eCategory}
                          onChange={(e) => setECategory(e.target.value)}
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                        >
                          <option value="">Category…</option>
                          {CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {categoryEmoji(c)} {c}
                            </option>
                          ))}
                        </select>
                        <input
                          value={eExpiry}
                          onChange={(e) => setEExpiry(e.target.value)}
                          type="date"
                          aria-label="Expiry date"
                          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink focus:border-brand focus:outline-none"
                        />
                      </div>
                      {qtyIsInvalid(eQty) && (
                        <p className="mt-2 text-xs font-semibold text-coral">
                          Quantity must be greater than 0.
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => saveEdit(key, item.purchase_date)}
                          disabled={!eName.trim() || eSaving || qtyIsInvalid(eQty)}
                          className="flex-1 rounded-xl bg-brand py-2.5 text-sm font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
                        >
                          {eSaving ? "Saving…" : "Save changes"}
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-bold text-muted transition active:scale-[0.99]"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => removeItem(key)}
                          aria-label="Remove item"
                          className="rounded-xl border border-coral/30 bg-coral/10 px-4 py-2.5 text-sm font-bold text-coral transition active:scale-[0.99]"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  );
                }

                return (
                  <li
                    key={key}
                    className={`flex items-center gap-3 rounded-2xl border border-black/5 border-l-4 bg-white px-3.5 py-3 shadow-sm ${s.accent}`}
                  >
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                      {foodEmoji(item.name, item.category)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{item.name}</p>
                      <p className="truncate text-xs text-muted">
                        {item.quantity != null
                          ? `${item.quantity} ${item.unit ?? ""}`.trim()
                          : item.category ?? "—"}
                        {added && <span className="text-muted/70"> · {added}</span>}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.chip}`}>
                      {s.label}
                    </span>
                    <button
                      onClick={() => startEdit(item)}
                      aria-label={`Edit ${item.name}`}
                      className="flex-shrink-0 rounded-full px-1.5 py-1 text-muted transition hover:text-brand"
                    >
                      ✎
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
