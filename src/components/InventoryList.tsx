"use client";

import type { InventoryItem } from "@/lib/types";

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
    case "pantry":    return "🫙";
    default:          return "🍽️";
  }
}

export default function InventoryList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0)
    return (
      <div className="mt-12 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-soft text-4xl">🧺</div>
        <p className="mt-4 font-semibold text-ink">Your pantry is empty</p>
        <p className="mt-1 text-sm text-muted">Scan a receipt to add what you bought.</p>
      </div>
    );

  const soon = items.filter((i) => {
    const d = daysUntilExpiry(i.expiry_date);
    return d !== null && d <= 2;
  }).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink shadow-sm">
          {items.length} items
        </span>
        {soon > 0 && (
          <span className="rounded-full bg-coral/15 px-3 py-1 text-xs font-semibold text-coral">
            ⚠️ {soon} expiring soon
          </span>
        )}
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => {
          const days = daysUntilExpiry(item.expiry_date);
          const s = expiryStyle(days);
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl border border-black/5 border-l-4 bg-white px-3.5 py-3 shadow-sm ${s.accent}`}
            >
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl">
                {categoryEmoji(item.category)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{item.name}</p>
                <p className="text-xs text-muted">
                  {item.quantity != null
                    ? `${item.quantity} ${item.unit ?? ""}`.trim()
                    : item.category ?? "—"}
                </p>
              </div>
              <span className={`flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.chip}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
