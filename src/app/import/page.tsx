"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionLogEntry } from "@/lib/browserbase";

type Status = "idle" | "running" | "succeeded" | "failed";

export default function ImportPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<ActionLogEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recipeId, setRecipeId] = useState<string | null>(null);

  async function handleImport() {
    if (!url.trim()) return;
    setStatus("running");
    setLog([]);
    setError(null);
    setRecipeId(null);

    try {
      const res = await fetch("/api/browserbase/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      setLog(data.actionLog ?? []);

      if (data.success) {
        setStatus("succeeded");
        setRecipeId(data.recipe?.id ?? null);
      } else {
        setStatus("failed");
        setError(data.error ?? "Import failed");
      }
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Import Recipe</h1>
      <p className="text-gray-500 text-sm mb-6">
        Paste a recipe blog URL or YouTube cooking video link.
        Browserbase will browse the page and Claude will structure it into a recipe.
      </p>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          placeholder="https://youtube.com/watch?v=... or https://..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:border-gray-400"
        />
        <button
          onClick={handleImport}
          disabled={status === "running" || !url.trim()}
          className="px-5 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
        >
          {status === "running" ? "Importing…" : "Import"}
        </button>
      </div>

      {url && (
        <p className="mt-2 text-xs text-gray-400">
          Mode: {isYouTube ? "YouTube → Stagehand (transcript + description)" : "Recipe page → Fetch → Stagehand fallback"}
        </p>
      )}

      {/* Browserbase Web Agent Console */}
      {(status !== "idle" || log.length > 0) && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Browserbase Web Agent Console
            </span>
            <StatusBadge status={status} />
          </div>

          <div className="px-4 py-3 space-y-1.5 max-h-64 overflow-y-auto">
            {log.length === 0 && status === "running" && (
              <p className="text-xs text-gray-400 animate-pulse">Starting Browserbase session…</p>
            )}
            {log.map((entry) => (
              <div key={entry.step} className="flex gap-3 text-xs">
                <span className="text-gray-400 font-mono w-4 flex-shrink-0">{entry.step}</span>
                <span className="text-gray-700 font-medium w-40 flex-shrink-0">{entry.action}</span>
                <span className="text-gray-500 truncate">{entry.result}</span>
              </div>
            ))}
          </div>

          {status === "succeeded" && (
            <div className="px-4 py-3 border-t border-gray-200 bg-green-50 flex items-center justify-between">
              <span className="text-sm text-green-700 font-medium">Recipe imported successfully</span>
              <div className="flex gap-2">
                {recipeId && (
                  <button
                    onClick={() => router.push(`/recipes/${recipeId}`)}
                    className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold"
                  >
                    View Recipe →
                  </button>
                )}
                <button
                  onClick={() => router.push("/recipes")}
                  className="px-3 py-1.5 rounded-lg border border-green-300 text-green-700 text-xs font-semibold"
                >
                  All Recipes
                </button>
              </div>
            </div>
          )}

          {status === "failed" && error && (
            <div className="px-4 py-3 border-t border-gray-200 bg-red-50">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {status === "idle" && (
        <div className="mt-8 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Try these</p>
          {[
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.allrecipes.com/recipe/24074/alysons-broccoli-salad/",
            "https://www.seriouseats.com/easy-pressure-cooker-chicken-tikka-masala",
          ].map((example) => (
            <button
              key={example}
              onClick={() => setUrl(example)}
              className="block w-full text-left text-xs text-blue-500 hover:underline truncate"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const map = {
    idle:      { label: "Idle",       cls: "bg-gray-100 text-gray-500" },
    running:   { label: "Running…",   cls: "bg-yellow-100 text-yellow-700 animate-pulse" },
    succeeded: { label: "Succeeded",  cls: "bg-green-100 text-green-700" },
    failed:    { label: "Failed",     cls: "bg-red-100 text-red-700" },
  };
  const { label, cls } = map[status];
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}
