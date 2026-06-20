"use client";

import { FormEvent, useState } from "react";
import type { BrowserbaseImportResult } from "@/lib/types";

export default function ImportRecipePage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<BrowserbaseImportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

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
      setError(requestError instanceof Error ? requestError.message : "Recipe import failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 px-6 py-12 text-stone-900">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">
          Browserbase Recipe Import
        </p>
        <h1 className="mt-3 text-4xl font-bold">Recipe blog to structured recipe</h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          Paste a public recipe blog URL. Pantry Agent tries fast Browserbase Fetch first,
          then opens a Stagehand browser session only when interaction is needed.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/my-recipe"
            className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-4 py-3 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-emerald-700 px-6 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Importing..." : "Import recipe"}
          </button>
        </form>

        {error && <p className="mt-5 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}

        {result && (
          <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              {result.recipe ? (
                <>
                  <p className="text-sm font-medium text-emerald-700">
                    Extracted with {result.extractionMode}
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">{result.recipe.title}</h2>
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold">Ingredients</h3>
                    <ul className="mt-3 space-y-2 text-stone-700">
                      {result.recipe.ingredients.map((ingredient, index) => (
                        <li key={`${ingredient.name}-${index}`}>
                          {ingredient.raw ??
                            `${ingredient.qty ?? ""} ${ingredient.unit ?? ""} ${ingredient.name}`.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-7">
                    <h3 className="text-lg font-semibold">Steps</h3>
                    <ol className="mt-3 list-decimal space-y-3 pl-5 text-stone-700">
                      {result.recipe.steps.map((step, index) => <li key={index}>{step}</li>)}
                    </ol>
                  </div>
                </>
              ) : (
                <div>
                  <h2 className="text-xl font-semibold text-red-700">Import failed</h2>
                  <p className="mt-2 text-stone-600">{result.errorMessage}</p>
                </div>
              )}
            </section>

            <aside className="rounded-2xl bg-stone-900 p-6 text-stone-100 shadow-sm">
              <h2 className="text-lg font-semibold">Browserbase run</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-400">Mode</dt>
                  <dd>{result.extractionMode}</dd>
                </div>
                {result.browserbaseSessionId && (
                  <div>
                    <dt className="text-stone-400">Session</dt>
                    <dd className="mt-1 break-all font-mono text-xs">{result.browserbaseSessionId}</dd>
                  </div>
                )}
              </dl>
              <ol className="mt-6 space-y-4 text-sm">
                {result.actionLog.map((entry) => (
                  <li key={entry.step}>
                    <p className="font-medium">{entry.step}. {entry.action}</p>
                    <p className="mt-1 text-stone-400">{entry.result}</p>
                  </li>
                ))}
              </ol>
              <div className="mt-6 flex gap-4 text-sm text-emerald-300">
                {result.browserbaseLiveUrl && (
                  <a href={result.browserbaseLiveUrl} target="_blank" rel="noreferrer">Live view</a>
                )}
                {result.browserbaseReplayUrl && (
                  <a href={result.browserbaseReplayUrl} target="_blank" rel="noreferrer">Session replay</a>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
