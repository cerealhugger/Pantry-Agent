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

  const num = parseFloat(trimmed);
  if (!isNaN(num) && String(num) === trimmed) return { quantity: num, unit: null };

  const match = trimmed.match(/^([\d.]+)\s*(.+)$/);
  if (match) {
    const n = parseFloat(match[1]);
    if (!isNaN(n)) return { quantity: n, unit: match[2].trim() };
  }

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
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Scan a receipt</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Snap your grocery receipt — Claude reads the items and estimates shelf life. Edit anything before saving.
      </p>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="cursor-pointer rounded-3xl border-2 border-dashed border-brand/35 bg-white p-6 text-center transition-colors hover:border-brand/70"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="receipt" className="mx-auto max-h-56 rounded-xl object-contain" />
        ) : (
          <div className="py-4">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-3xl">
              📸
            </div>
            <p className="text-sm font-medium text-ink">Tap to take a photo or upload</p>
            <p className="mt-0.5 text-xs text-muted">A photo of your receipt</p>
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
          className="mt-4 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-md shadow-brand/25 transition active:scale-[0.99] disabled:opacity-50"
        >
          {scanning ? "Reading your receipt…" : "✨ Scan with Claude"}
        </button>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-coral/10 px-3 py-2 text-sm font-medium text-coral">{error}</p>
      )}

      {/* Editable item list */}
      {items.length > 0 && (
        <div className="mt-6 space-y-2.5">
          <p className="text-sm font-semibold text-ink">
            Found {items.length} item{items.length !== 1 ? "s" : ""}{" "}
            <span className="font-normal text-muted">· edit or untick before saving</span>
          </p>

          {items.map((item, i) => (
            <div
              key={i}
              className={`rounded-2xl border border-black/5 bg-white px-3.5 py-3 transition ${
                item.selected ? "shadow-sm" : "opacity-40"
              }`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => updateItem(setItems, i, { selected: !item.selected })}
                  className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 text-[11px] text-white ${
                    item.selected ? "border-brand bg-brand" : "border-black/20"
                  }`}
                >
                  {item.selected ? "✓" : ""}
                </button>

                <div className="flex-1 space-y-2">
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(setItems, i, { name: e.target.value })}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Item name"
                    className="w-full border-b border-transparent bg-transparent text-sm font-semibold text-ink hover:border-black/10 focus:border-brand focus:outline-none"
                  />

                  <div className="flex items-center gap-2">
                    <input
                      value={item.quantityText}
                      onChange={(e) => updateItem(setItems, i, { quantityText: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="数量 e.g. 2、一把、500"
                      className="w-32 border-b border-transparent bg-transparent text-sm text-muted hover:border-black/10 focus:border-brand focus:outline-none"
                    />
                    <input
                      value={item.unit}
                      onChange={(e) => updateItem(setItems, i, { unit: e.target.value })}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="单位 e.g. g、pcs、袋"
                      className="w-24 border-b border-transparent bg-transparent text-sm text-muted hover:border-black/10 focus:border-brand focus:outline-none"
                    />
                    <span className="ml-auto rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-dark">
                      ~{item.estimated_shelf_life_days}d
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={handleSave}
            disabled={saving || selectedCount === 0}
            className="mt-1 w-full rounded-2xl bg-brand py-3.5 font-bold text-white shadow-md shadow-brand/25 transition active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? "Saving…" : `Add ${selectedCount} item${selectedCount !== 1 ? "s" : ""} to pantry`}
          </button>
        </div>
      )}

      {saved && (
        <div className="mt-4 rounded-2xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm font-medium text-brand-dark">
          ✓ Added to your pantry!{" "}
          <a href="/inventory" className="font-bold underline">
            View pantry →
          </a>
        </div>
      )}
    </main>
  );
}
