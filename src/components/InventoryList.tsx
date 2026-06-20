"use client";

import type { InventoryItem } from "@/lib/types";

function daysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const diff = new Date(expiryDate).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }: { days: number | null }) {
  if (days === null) return null;

  if (days <= 0)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expired</span>;
  if (days <= 2)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">Expires in {days}d ⚠️</span>;
  if (days <= 7)
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Expires in {days}d</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Expires in {days}d</span>;
}

function categoryColor(category: string | null): string {
  switch (category) {
    case "vegetable": return "bg-emerald-50 text-emerald-700";
    case "meat":      return "bg-rose-50 text-rose-700";
    case "dairy":     return "bg-blue-50 text-blue-700";
    case "pantry":    return "bg-amber-50 text-amber-700";
    default:          return "bg-gray-50 text-gray-600";
  }
}

export default function InventoryList({ items }: { items: InventoryItem[] }) {
  if (items.length === 0)
    return <p className="text-gray-400 text-sm">No items in pantry.</p>;

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const days = daysUntilExpiry(item.expiry_date);
        const urgent = days !== null && days <= 2;

        return (
          <li
            key={item.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
              urgent ? "border-red-200 bg-red-50" : "border-gray-100 bg-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${categoryColor(item.category)}`}>
                {item.category ?? "other"}
              </span>
              <span className="font-medium text-gray-900">{item.name}</span>
              {item.quantity != null && (
                <span className="text-sm text-gray-500">
                  {item.quantity} {item.unit}
                </span>
              )}
            </div>
            <ExpiryBadge days={days} />
          </li>
        );
      })}
    </ul>
  );
}
