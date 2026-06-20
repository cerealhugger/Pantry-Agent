import type { Recipe, InventoryItem } from "./types";

// Common staples we assume are always on hand, so recipes don't show them as "missing".
const STAPLES = ["salt", "pepper", "water"];

function norm(s: string) {
  return (s ?? "").toLowerCase().trim();
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function findStock(name: string, inventory: InventoryItem[]): InventoryItem | null {
  const n = norm(name);
  if (!n) return null;
  return (
    inventory.find((it) => {
      const inv = norm(it.name);
      return inv === n || inv.includes(n) || n.includes(inv);
    }) ?? null
  );
}

export function inStock(name: string, inventory: InventoryItem[]): boolean {
  if (STAPLES.some((s) => norm(name).includes(s))) return true;
  return findStock(name, inventory) !== null;
}

export type Coverage = {
  have: string[];
  missing: string[];
  ratio: number; // 0..1 of ingredients you already have
  expiringUsed: number; // how many ingredients are expiring soon (good to use up)
};

export function coverage(recipe: Recipe, inventory: InventoryItem[], soonDays = 3): Coverage {
  const ings = recipe.ingredients ?? [];
  const have: string[] = [];
  const missing: string[] = [];
  let expiringUsed = 0;

  for (const ing of ings) {
    const name = ing?.name ?? "";
    if (inStock(name, inventory)) {
      have.push(name);
      const stock = findStock(name, inventory);
      const d = stock ? daysUntil(stock.expiry_date) : null;
      if (d !== null && d <= soonDays) expiringUsed++;
    } else {
      missing.push(name);
    }
  }

  const total = ings.length || 1;
  return { have, missing, ratio: have.length / total, expiringUsed };
}

// Rank recipes: prioritize using soon-to-expire items, then overall coverage.
export function recommend(recipes: Recipe[], inventory: InventoryItem[]) {
  return recipes
    .map((recipe) => ({ recipe, cov: coverage(recipe, inventory) }))
    .sort((a, b) =>
      b.cov.expiringUsed !== a.cov.expiringUsed
        ? b.cov.expiringUsed - a.cov.expiringUsed
        : b.cov.ratio - a.cov.ratio
    );
}
