"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import type { BrowserbaseImportResult } from "@/lib/types";
import { NutritionEvidenceTable } from "@/components/NutritionEvidence";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = createClient<any>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ImportRecipePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<BrowserbaseImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  async function handleSave() {
    if (!result?.recipe) return;
    setSaving(true);
    const { data, error: dbError } = await supabase
      .from("recipes")
      .insert({
        user_id: "demo",
        title: result.recipe.title,
        ingredients: result.recipe.ingredients,
        steps: result.recipe.steps,
        calories_per_serving: result.recipe.calories_per_serving,
        servings: result.recipe.servings,
        tags: result.recipe.tags,
        source_type: result.recipe.source_type,
        source_url: result.inputUrl,
        extraction_confidence: result.recipe.extraction_confidence ?? null,
        source_metadata: result.recipe.source_metadata ?? {},
      })
      .select()
      .single();
    setSaving(false);
    if (dbError) {
      alert("Failed to save: " + dbError.message);
    } else {
      setSavedId(data.id);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    setSavedId(null);

    try {
      const response = await fetch("/api/browserbase/import-recipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok && !data.actionLog) {
        throw new Error(data.error || "Recipe import failed");
      }
      setResult(data);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Recipe import failed"
      );
    } finally {
      setLoading(false);
    }
  }

  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  const importedNutrition = result?.recipe?.source_metadata?.nutrition;

  return (
    <main className="px-5 pt-5">
      <h1 className="text-2xl font-extrabold tracking-tight text-ink">Import a recipe</h1>
      <p className="mb-5 mt-1 text-sm text-muted">
        Paste a recipe blog or YouTube link — Browserbase browses the real page and Claude
        structures it into a recipe you can trust.
      </p>

      {/* URL input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://youtube.com/watch?v=… or a recipe URL"
          className="min-w-0 flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-3 text-sm text-ink focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="whitespace-nowrap rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white shadow-sm shadow-brand/25 transition active:scale-95 disabled:opacity-50"
        >
          {loading ? "Importing + checking nutrition…" : "Import"}
        </button>
      </form>

      {url && (
        <p className="mt-2 text-xs text-muted">
          Mode:{" "}
          {isYouTube
            ? "YouTube → Stagehand (transcript + description)"
            : "Recipe page → Fetch → Stagehand fallback"}
        </p>
      )}

      {/* Top-level request error */}
      {error && (
        <div className="mt-5 rounded-2xl border border-black/5 bg-coral/10 px-4 py-3">
          <p className="text-sm text-coral">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5">
          {/* Extracted recipe preview */}
          {result.recipe ? (
            <section className="card overflow-hidden">
              <div className="flex items-start justify-between gap-3 border-b border-black/5 bg-brand-soft px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-dark">
                    Extracted with {result.extractionMode}
                  </p>
                  <h2 className="mt-1 truncate text-lg font-extrabold text-ink">
                    {result.recipe.title}
                  </h2>
                </div>
                {savedId ? (
                  <button
                    onClick={() => router.push(`/recipes/${savedId}`)}
                    className="flex-shrink-0 whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white"
                  >
                    View recipe →
                  </button>
                ) : (
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-shrink-0 whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {saving ? "Saving…" : "Save to Recipes"}
                  </button>
                )}
              </div>

              <div className="px-4 py-4">
                {result.recipe.calories_per_serving != null && (
                  <div
                    className={`mb-4 rounded-xl border px-3 py-3 ${
                      importedNutrition
                        ? "border-emerald-200 bg-emerald-50/70"
                        : "border-black/5 bg-cream"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p className="font-bold text-ink">
                        {importedNutrition ? "Estimated calories" : "Page-reported calories"}: {result.recipe.calories_per_serving} kcal / serving
                      </p>
                      {importedNutrition && (
                        <span className="text-xs font-semibold capitalize text-emerald-700">
                          {importedNutrition.confidence} confidence
                        </span>
                      )}
                    </div>
                    {importedNutrition && (
                      <>
                        <p className="mt-1 text-xs text-muted">
                          Source: {importedNutrition.estimationMethod === "ai_fallback"
                            ? "AI estimate after Browserbase nutrition search"
                            : importedNutrition.estimationMethod === "hybrid"
                              ? "Browserbase evidence + AI fallback"
                              : "Browserbase Search + Fetch evidence"}
                        </p>
                        <NutritionEvidenceTable evidence={importedNutrition.evidence} />
                      </>
                    )}
                  </div>
                )}

                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Ingredients
                </p>
                <ul className="mt-2 space-y-1.5">
                  {result.recipe.ingredients.map((ingredient, index) => (
                    <li
                      key={`${ingredient.name}-${index}`}
                      className="flex gap-2 text-sm text-ink"
                    >
                      <span className="mt-2 h-1 w-1 flex-shrink-0 rounded-full bg-brand" />
                      <span>
                        {ingredient.raw ??
                          `${ingredient.qty ?? ""} ${ingredient.unit ?? ""} ${ingredient.name}`.trim()}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Steps
                </p>
                <ol className="mt-2 space-y-2.5">
                  {result.recipe.steps.map((step, index) => (
                    <li key={index} className="flex gap-3 text-sm text-ink">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-dark">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          ) : (
            <div className="rounded-2xl border border-black/5 bg-coral/10 px-4 py-3">
              <p className="text-sm font-bold text-coral">Import failed</p>
              <p className="mt-1 text-sm text-muted">{result.errorMessage}</p>
            </div>
          )}

          {/* Browserbase Web Agent Console */}
          <section className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Browserbase Web Agent Console
              </span>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-dark">
                {result.extractionMode}
              </span>
            </div>

            <div className="space-y-1 px-4 py-3">
              {result.browserbaseSessionId && (
                <div className="flex justify-between gap-4 text-xs">
                  <span className="text-muted">Session</span>
                  <span className="break-all font-mono text-ink">
                    {result.browserbaseSessionId}
                  </span>
                </div>
              )}
            </div>

            <div className="max-h-64 space-y-1.5 overflow-y-auto border-t border-black/5 px-4 py-3 no-scrollbar">
              {result.actionLog.map((entry) => (
                <div key={entry.step} className="flex gap-3 text-xs">
                  <span className="w-4 flex-shrink-0 font-mono text-muted">{entry.step}</span>
                  <span className="w-36 flex-shrink-0 font-semibold text-ink">
                    {entry.action}
                  </span>
                  <span className="truncate text-muted">{entry.result}</span>
                </div>
              ))}
            </div>

            {(result.browserbaseLiveUrl || result.browserbaseReplayUrl) && (
              <div className="flex gap-4 border-t border-black/5 bg-cream px-4 py-3 text-xs font-bold text-brand">
                {result.browserbaseLiveUrl && (
                  <a href={result.browserbaseLiveUrl} target="_blank" rel="noreferrer">
                    Live view →
                  </a>
                )}
                {result.browserbaseReplayUrl && (
                  <a href={result.browserbaseReplayUrl} target="_blank" rel="noreferrer">
                    Session replay →
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tips */}
      {!result && !loading && (
        <div className="mt-8 space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Try this
          </p>
          {[
            "https://www.recipetineats.com/portuguese-chicken-and-rice-one-pot-recipe/",
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
