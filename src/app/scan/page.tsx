"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ParsedItem = {
  name: string;
  quantityText: string; // free text: "2", "一把", "500g", etc.
  unit: string;
  category: string;
  estimated_shelf_life_days: number;
  selected: boolean;
};

function parseQuantity(text: string): { quantity: number | null; unit: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { quantity: null, unit: null };

  // pure number → quantity only
  const num = parseFloat(trimmed);
  if (!isNaN(num) && String(num) === trimmed) return { quantity: num, unit: null };

  // number + unit, e.g. "500g", "1.5 lb"
  const match = trimmed.match(/^([\d.]+)\s*(.+)$/);
  if (match) {
    const n = parseFloat(match[1]);
    if (!isNaN(n)) return { quantity: n, unit: match[2].trim() };
  }

  // pure text like "一把" → store in unit, quantity null
  return { quantity: null, unit: trimmed };
}

function updateItem(
  setItems: React.Dispatch<React.SetStateAction<ParsedItem[]>>,
  index: number,
  patch: Partial<ParsedItem>
) {
  setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string>("image/jpeg");
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    setSaved(false);
    setItems([]);
    setMediaType(file.type || "image/jpeg");
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setPreview(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
    };
    reader.readAsDataURL(file);
  }

  async function handleScan() {
    if (!imageBase64) return;
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/scan-receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mediaType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setItems(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data.items.map((i: any) => ({
          name: i.name ?? "",
          quantityText: i.quantity != null ? String(i.quantity) : "",
          unit: i.unit ?? "",
          category: i.category ?? "other",
          estimated_shelf_life_days: i.estimated_shelf_life_days ?? 7,
          selected: true,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    const toSave = items.filter((i) => i.selected);
    if (toSave.length === 0) return;
    setSaving(true);
    setError(null);

    const today = new Date().toISOString().split("T")[0];
    const rows = toSave.map((item) => {
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + item.estimated_shelf_life_days);

      // merge quantityText + unit into structured fields
      const combined = [item.quantityText, item.unit].filter(Boolean).join(" ").trim();
      const { quantity, unit } = parseQuantity(combined || item.quantityText);

      return {
        user_id: "demo",
        name: item.name,
        quantity,
        unit,
        category: item.category,
        purchase_date: today,
        expiry_date: expiry.toISOString().split("T")[0],
      };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: dbError } = await supabase.from("inventory_items").insert(rows as any);
    if (dbError) {
      setError(dbError.message);
    } else {
      setSaved(true);
      setItems([]);
      setPreview(null);
      setImageBase64(null);
    }
    setSaving(false);
  }

  const selectedCount = items.filter((i) => i.selected).length;

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Scan Receipt</h1>
      <p className="text-gray-500 text-sm mb-6">
        Take a photo of your grocery receipt — Claude extracts the food items.
        Edit any field before saving.
      </p>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="receipt" className="mx-auto max-h-56 object-contain rounded-lg" />
        ) : (
          <div className="text-gray-400">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-sm">Tap to take a photo or upload an image</p>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {preview && items.length === 0 && (
        <button
          onClick={handleScan}
          disabled={scanning}
          className="mt-4 w-full py-3 rounded-xl bg-gray-900 text-white font-semibold disabled:opacity-50"
        >
          {scanning ? "Scanning…" : "Scan with Claude"}
        </button>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {/* Editable item list */}
      {items.length > 0 && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-gray-500">
            Edit name / amount before saving. Tap the checkbox to skip an item.
          </p>

          {items.map((item, i) => (
            <div
              key={i}
              className={`rounded-xl border px-4 py-3 transition-opacity ${
                item.selected ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-40"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* checkbox */}
                <button
                  onClick={() => updateItem(setItems, i, { selected: !item.selected })}
                  className={`mt-1 w-5 h-5 rounded-full border-2 flex-shrink-0 ${
                    item.selected ? "bg-gray-900 border-gray-900" : "border-gray-300"
                  }`}
                />

                <div className="flex-1 space-y-2">
                  {/* name */}
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(setItems, i, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Item name"
                    className="w-full text-sm font-medium text-gray-900 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none bg-transparent"
                  />

                  <div className="flex gap-2">
                    {/* quantity — free text */}
                    <input
                      value={item.quantityText}
                      onChange={(e) => updateItem(setItems, i, { quantityText: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="数量 e.g. 2、一把、500"
                      className="w-32 text-sm text-gray-600 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none bg-transparent"
                    />
                    {/* unit */}
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(setItems, i, { unit: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="单位 e.g. g、pcs、袋"
                      className="w-24 text-sm text-gray-600 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none bg-transparent"
                    />
                    <span className="ml-auto text-xs text-gray-400 self-end">
                      {item.category} · ~{item.estimated_shelf_life_days}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="w-full py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : `Add ${selectedCount} item${selectedCount !== 1 ? "s" : ""} to Pantry`}
          </button>
        </div>
      )}

      {saved && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm font-medium">
          ✓ Items added!{" "}
          <a href="/inventory" className="underline">
            View inventory →
          </a>
        </div>
      )}
    </main>
  );
}
