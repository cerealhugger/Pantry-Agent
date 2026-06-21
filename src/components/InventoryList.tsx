"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { InventoryItem } from "@/lib/types";

type InventoryForm = {
  name: string;
  quantity: string;
  unit: string;
  category: string;
  purchase_date: string;
  expiry_date: string;
};

const CATEGORIES = ["vegetable", "meat", "dairy", "other"];
const CATEGORY_TABS = ["all", ...CATEGORIES];
const OTHER_STAPLES = ["salt", "pepper", "oil"];

type InventoryPayload = ReturnType<typeof toInventoryPayload>;

function today() {
  return new Date().toISOString().split("T")[0];
}

function emptyForm(): InventoryForm {
  return {
    name: "",
    quantity: "",
    unit: "",
    category: "other",
    purchase_date: today(),
    expiry_date: "",
  };
}

function formFromItem(item: InventoryItem): InventoryForm {
  return {
    name: item.name,
    quantity: item.quantity?.toString() ?? "",
    unit: item.unit ?? "",
    category: itemCategory(item),
    purchase_date: item.purchase_date ?? today(),
    expiry_date: item.expiry_date ?? "",
  };
}

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function normalizedCategory(name: string, category: string | null) {
  const lowerName = norm(name);
  if (OTHER_STAPLES.some((staple) => lowerName.includes(staple))) return "other";
  if (category && CATEGORIES.includes(category)) return category;
  return "other";
}

function itemCategory(item: InventoryItem) {
  return normalizedCategory(item.name, item.category);
}

function toInventoryPayload(form: InventoryForm) {
  const name = form.name.trim();
  const quantity = form.quantity.trim() === "" ? null : Number(form.quantity);
  const category = normalizedCategory(name, form.category);

  return {
    user_id: "demo",
    name,
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit: form.unit.trim() || null,
    category,
    purchase_date: form.purchase_date || today(),
    expiry_date: form.expiry_date || null,
  };
}

function mergeKey(name: string, unit: string | null, category: string | null) {
  return `${norm(name)}::${norm(unit)}::${normalizedCategory(name, category)}`;
}

function sameIngredient(item: InventoryItem, payload: InventoryPayload) {
  return mergeKey(item.name, item.unit, item.category) === mergeKey(payload.name, payload.unit, payload.category);
}

function combinedQuantity(current: number | null, added: number | null) {
  if (current == null) return added;
  if (added == null) return current;
  return current + added;
}

function earlierDate(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

function mergedPayload(target: InventoryItem, payload: InventoryPayload) {
  return {
    ...payload,
    name: target.name,
    quantity: combinedQuantity(target.quantity, payload.quantity),
    expiry_date: earlierDate(target.expiry_date, payload.expiry_date),
  };
}

function sortInventory(items: InventoryItem[]) {
  return [...items].sort((a, b) => {
    if (!a.expiry_date && !b.expiry_date) return a.name.localeCompare(b.name);
    if (!a.expiry_date) return 1;
    if (!b.expiry_date) return -1;
    return a.expiry_date.localeCompare(b.expiry_date);
  });
}

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
    case "meat":      return "🍖";
    case "dairy":     return "🧀";
    default:          return "🍽️";
  }
}

function InventoryFields({
  form,
  onChange,
  disabled,
}: {
  form: InventoryForm;
  onChange: (next: InventoryForm) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <label className="col-span-2">
        <span className="sr-only">Ingredient name</span>
        <input
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          disabled={disabled}
          placeholder="Ingredient"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand"
        />
      </label>
      <label>
        <span className="sr-only">Quantity</span>
        <input
          value={form.quantity}
          onChange={(e) => onChange({ ...form, quantity: e.target.value })}
          disabled={disabled}
          inputMode="decimal"
          placeholder="Qty"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>
      <label>
        <span className="sr-only">Unit</span>
        <input
          value={form.unit}
          onChange={(e) => onChange({ ...form, unit: e.target.value })}
          disabled={disabled}
          placeholder="Unit"
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>
      <label className="col-span-2">
        <span className="sr-only">Category</span>
        <select
          value={form.category}
          onChange={(e) => onChange({ ...form, category: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink outline-none transition focus:border-brand"
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Bought</span>
        <input
          type="date"
          value={form.purchase_date}
          onChange={(e) => onChange({ ...form, purchase_date: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>
      <label>
        <span className="mb-1 block text-[10px] font-bold uppercase text-muted">Expires</span>
        <input
          type="date"
          value={form.expiry_date}
          onChange={(e) => onChange({ ...form, expiry_date: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-ink outline-none transition focus:border-brand"
        />
      </label>
    </div>
  );
}

export default function InventoryList({ items }: { items: InventoryItem[] }) {
  const [pantryItems, setPantryItems] = useState(() => sortInventory(items));
  const [draft, setDraft] = useState<InventoryForm>(() => emptyForm());
  const [addingExpanded, setAddingExpanded] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<InventoryForm>(() => emptyForm());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const soon = pantryItems.filter((i) => {
    const d = daysUntilExpiry(i.expiry_date);
    return d !== null && d <= 2;
  }).length;
  const visibleItems =
    activeCategory === "all"
      ? pantryItems
      : pantryItems.filter((item) => itemCategory(item) === activeCategory);

  function categoryCount(category: string) {
    if (category === "all") return pantryItems.length;
    return pantryItems.filter((item) => itemCategory(item) === category).length;
  }

  async function addItem() {
    if (!addingExpanded) {
      setAddingExpanded(true);
      return;
    }

    const payload = toInventoryPayload(draft);
    if (!payload.name || busy) return;

    setBusy(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inventoryTable = supabase.from("inventory_items") as any;
    const mergeTarget = pantryItems.find((item) => sameIngredient(item, payload));

    if (mergeTarget) {
      const { data, error: mergeError } = await inventoryTable
        .update(mergedPayload(mergeTarget, payload))
        .eq("id", mergeTarget.id)
        .eq("user_id", "demo")
        .select()
        .single();

      if (mergeError) {
        setError(mergeError.message);
      } else if (data) {
        setPantryItems((prev) =>
          sortInventory(prev.map((item) => (item.id === mergeTarget.id ? data as InventoryItem : item)))
        );
        setDraft(emptyForm());
        setAddingExpanded(false);
        setActiveCategory("all");
      }
      setBusy(false);
      return;
    }

    const { data, error: insertError } = await inventoryTable
      .insert(payload)
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
    } else if (data) {
      setPantryItems((prev) => sortInventory([data as InventoryItem, ...prev]));
      setDraft(emptyForm());
      setAddingExpanded(false);
      setActiveCategory("all");
    }
    setBusy(false);
  }

  function startEditing(item: InventoryItem) {
    setEditingId(item.id);
    setEditDraft(formFromItem(item));
    setError(null);
  }

  async function saveEdit(item: InventoryItem) {
    const payload = toInventoryPayload(editDraft);
    if (!payload.name || busy) return;

    setBusy(true);
    setError(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inventoryTable = supabase.from("inventory_items") as any;
    const mergeTarget = pantryItems.find((current) => current.id !== item.id && sameIngredient(current, payload));

    if (mergeTarget) {
      const { data, error: mergeError } = await inventoryTable
        .update(mergedPayload(mergeTarget, payload))
        .eq("id", mergeTarget.id)
        .eq("user_id", "demo")
        .select()
        .single();

      if (mergeError) {
        setError(mergeError.message);
        setBusy(false);
        return;
      }

      const { error: deleteError } = await supabase
        .from("inventory_items")
        .delete()
        .eq("id", item.id)
        .eq("user_id", "demo");

      if (deleteError) {
        setError(deleteError.message);
      } else if (data) {
        setPantryItems((prev) =>
          sortInventory(
            prev
              .filter((current) => current.id !== item.id)
              .map((current) => (current.id === mergeTarget.id ? data as InventoryItem : current))
          )
        );
        setEditingId(null);
        setActiveCategory("all");
      }
      setBusy(false);
      return;
    }

    const { data, error: updateError } = await inventoryTable
      .update(payload)
      .eq("id", item.id)
      .eq("user_id", "demo")
      .select()
      .single();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      setPantryItems((prev) =>
        sortInventory(prev.map((current) => (current.id === item.id ? data as InventoryItem : current)))
      );
      setEditingId(null);
    }
    setBusy(false);
  }

  async function deleteItem(item: InventoryItem) {
    if (busy) return;
    if (!confirm(`Delete ${item.name} from your pantry?`)) return;

    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("id", item.id)
      .eq("user_id", "demo");

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setPantryItems((prev) => prev.filter((current) => current.id !== item.id));
      if (editingId === item.id) setEditingId(null);
    }
    setBusy(false);
  }

  async function emptyFridge() {
    if (busy || pantryItems.length === 0) return;
    const confirmation = prompt(
      `This will permanently delete all ${pantryItems.length} pantry item${pantryItems.length === 1 ? "" : "s"}. Type EMPTY to confirm.`
    );
    if (confirmation !== "EMPTY") return;

    setBusy(true);
    setError(null);
    const { error: deleteError } = await supabase
      .from("inventory_items")
      .delete()
      .eq("user_id", "demo");

    if (deleteError) {
      setError(deleteError.message);
    } else {
      setPantryItems([]);
      setEditingId(null);
    }
    setBusy(false);
  }

  return (
    <div>
      <section className="mb-5 rounded-2xl border border-black/5 bg-white p-3.5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-ink">Add ingredient</h2>
          <button
            onClick={addItem}
            disabled={busy || (addingExpanded && !draft.name.trim())}
            className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {addingExpanded ? (
          <InventoryFields form={draft} onChange={setDraft} disabled={busy} />
        ) : (
          <label>
            <span className="sr-only">Ingredient name</span>
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              disabled={busy}
              placeholder="Ingredient"
              className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-ink outline-none transition focus:border-brand"
            />
          </label>
        )}
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm">
          {pantryItems.length} item{pantryItems.length !== 1 ? "s" : ""}
        </span>
        {soon > 0 && (
          <span className="rounded-full bg-coral/15 px-3 py-1 text-xs font-semibold text-coral">
            ⚠️ {soon} expiring soon
          </span>
        )}
        {pantryItems.length > 0 && (
          <button
            onClick={emptyFridge}
            disabled={busy}
            className="rounded-full border border-coral/20 bg-coral/10 px-3 py-1 text-xs font-bold text-coral transition active:scale-95 disabled:opacity-40"
          >
            Empty my fridge
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-xl bg-coral/10 px-3 py-2 text-sm font-semibold text-coral">
          {error}
        </p>
      )}

      {pantryItems.length > 0 && (
        <div className="no-scrollbar mb-4 -mx-5 overflow-x-auto px-5">
          <div className="flex gap-2">
            {CATEGORY_TABS.map((category) => {
              const count = categoryCount(category);
              const active = activeCategory === category;
              return (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-bold capitalize transition active:scale-95 ${
                    active
                      ? "bg-brand text-white shadow-sm shadow-brand/20"
                      : "bg-white text-muted shadow-sm"
                  }`}
                >
                  {category} {count}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {pantryItems.length === 0 && (
        <div className="mt-8 flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-4xl">🧺</div>
          <p className="mt-4 font-semibold text-ink">Your pantry is empty</p>
          <p className="mt-1 text-sm text-muted">Scan a receipt or add an ingredient manually.</p>
        </div>
      )}

      <ul className="space-y-2.5">
        {visibleItems.map((item) => {
          const days = daysUntilExpiry(item.expiry_date);
          const s = expiryStyle(days);
          const editing = editingId === item.id;
          return (
            <li
              key={item.id}
              className={`rounded-2xl border border-black/5 border-l-4 bg-white px-3.5 py-3 shadow-sm ${s.accent}`}
            >
              {editing ? (
                <div className="space-y-3">
                  <InventoryFields form={editDraft} onChange={setEditDraft} disabled={busy} />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setEditingId(null)}
                      disabled={busy}
                      className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-bold text-muted transition active:scale-95 disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(item)}
                      disabled={!editDraft.name.trim() || busy}
                      className="rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-white transition active:scale-95 disabled:opacity-40"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                    {categoryEmoji(itemCategory(item))}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{item.name}</p>
                    <p className="text-xs text-muted">
                      {item.quantity != null
                        ? `${item.quantity} ${item.unit ?? ""}`.trim()
                        : itemCategory(item)}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.chip}`}>
                    {s.label}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEditing(item)}
                      disabled={busy}
                      className="rounded-full px-2 py-1 text-xs font-bold text-muted transition hover:bg-brand-soft hover:text-brand-dark active:scale-95 disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteItem(item)}
                      disabled={busy}
                      aria-label={`Delete ${item.name}`}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-muted transition hover:bg-coral/10 hover:text-coral active:scale-95 disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
