"use client";

import { useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ParsedItem = {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  estimated_shelf_life_days: number;
  selected: boolean;
};

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
      // strip the "data:image/...;base64," prefix
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
      setItems(data.items.map((i: Omit<ParsedItem, "selected">) => ({ ...i, selected: true })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  function toggle(index: number) {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
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
      return {
        user_id: "demo",
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
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

  return (
    <main className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Scan Receipt</h1>
      <p className="text-gray-500 text-sm mb-6">
        Take a photo of your grocery receipt or shopping bag — Claude will extract the items.
      </p>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
      >
        {preview ? (
          <img src={preview} alt="receipt preview" className="mx-auto max-h-64 object-contain rounded-lg" />
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

      {/* Parsed items */}
      {items.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold text-gray-800 mb-3">Found {items.length} items — tap to deselect</h2>
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={i}
                onClick={() => toggle(i)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 cursor-pointer transition-opacity ${
                  item.selected ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-40"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${item.selected ? "bg-gray-900 border-gray-900" : "border-gray-300"}`} />
                  <span className="font-medium text-gray-900">{item.name}</span>
                  {item.quantity && (
                    <span className="text-sm text-gray-500">{item.quantity} {item.unit}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{item.category}</span>
                  <span className="text-xs text-gray-400">~{item.estimated_shelf_life_days}d</span>
                </div>
              </li>
            ))}
          </ul>

          <button
            onClick={handleSave}
            disabled={saving || items.filter((i) => i.selected).length === 0}
            className="mt-4 w-full py-3 rounded-xl bg-green-600 text-white font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : `Add ${items.filter((i) => i.selected).length} items to Pantry`}
          </button>
        </div>
      )}

      {saved && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-green-700 text-sm font-medium">
          ✓ Items added to your pantry! <a href="/inventory" className="underline">View inventory →</a>
        </div>
      )}
    </main>
  );
}
