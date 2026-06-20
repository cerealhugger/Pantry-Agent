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
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Import a recipe</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Paste a recipe blog or YouTube link — Browserbase browses the page and Claude structures it into a
        recipe you can trust.
      </p>

      {/* URL input */}
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleImport()}
          placeholder="https://youtube.com/watch?v=… or a recipe URL"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button
          onClick={handleImport}
          disabled={status === "running" || !url.trim()}
          className="whitespace-nowrap rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm shadow-brand/25 transition active:scale-95 disabled:opacity-50"
        >
          {status === "running" ? "Importing…" : "Import"}
        </button>
      </div>

      {url && (
        <p className="mt-2 text-xs text-muted">
          Mode: {isYouTube ? "YouTube → Stagehand (transcript + description)" : "Recipe page → Fetch → Stagehand fallback"}
        </p>
      )}

      {/* Browserbase Web Agent Console */}
      {(status !== "idle" || log.length > 0) && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Browserbase Web Agent Console
            </span>
            <StatusBadge status={status} />
          </div>

          <div className="max-h-64 space-y-1.5 overflow-y-auto px-4 py-3">
            {log.length === 0 && status === "running" && (
              <p className="animate-pulse text-xs text-muted">Starting Browserbase session…</p>
            )}
            {log.map((entry) => (
              <div key={entry.step} className="flex gap-3 text-xs">
                <span className="w-4 flex-shrink-0 font-mono text-muted">{entry.step}</span>
                <span className="w-40 flex-shrink-0 font-semibold text-ink">{entry.action}</span>
                <span className="truncate text-muted">{entry.result}</span>
              </div>
            ))}
          </div>

          {status === "succeeded" && (
            <div className="flex items-center justify-between border-t border-black/5 bg-brand-soft px-4 py-3">
              <span className="text-sm font-medium text-brand-dark">Recipe imported</span>
              <div className="flex gap-2">
                {recipeId && (
                  <button
                    onClick={() => router.push(`/recipes/${recipeId}`)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white"
                  >
                    View recipe →
                  </button>
                )}
                <button
                  onClick={() => router.push("/recipes")}
                  className="rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-bold text-brand-dark"
                >
                  All recipes
                </button>
              </div>
            </div>
          )}

          {status === "failed" && error && (
            <div className="border-t border-black/5 bg-coral/10 px-4 py-3">
              <p className="text-sm text-coral">{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {status === "idle" && (
        <div className="mt-8 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Try these</p>
          {[
            "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "https://www.allrecipes.com/recipe/24074/alysons-broccoli-salad/",
            "https://www.seriouseats.com/easy-pressure-cooker-chicken-tikka-masala",
          ].map((example) => (
            <button
              key={example}
              onClick={() => setUrl(example)}
              className="block w-full truncate text-left text-xs text-brand hover:underline"
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
    idle: { label: "Idle", cls: "bg-black/5 text-muted" },
    running: { label: "Running…", cls: "bg-amber/25 text-[#a76a14] animate-pulse" },
    succeeded: { label: "Succeeded", cls: "bg-brand-soft text-brand-dark" },
    failed: { label: "Failed", cls: "bg-coral/15 text-coral" },
  };
  const { label, cls } = map[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
