"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { NutritionVerificationResult, SavedNutrition } from "@/lib/types";
import {
  NutritionSummary,
  NutritionEvidenceTable,
} from "@/components/NutritionEvidence";

export default function NutritionSection({
  recipeId,
  aiCaloriesPerServing,
  saved,
}: {
  recipeId: string;
  aiCaloriesPerServing: number | null;
  saved: SavedNutrition | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<NutritionVerificationResult | null>(null);

  async function handleVerify() {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/browserbase/nutrition-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId }),
      });
      const data: NutritionVerificationResult = await res.json();
      if (data.status !== "succeeded") {
        throw new Error(data.errorMessage || "Verification failed");
      }
      setResult(data);
      router.refresh(); // pull the freshly-saved nutrition into the server render
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  }

  // Prefer the just-run result; otherwise fall back to what was saved on the recipe.
  const summary = result
    ? {
        estimated: result.estimatedCaloriesPerServing,
        ai: result.aiCaloriesPerServing,
        confidence: result.overallConfidence,
        reasoning: result.reasoning,
        evidence: result.evidence,
        actionLog: result.actionLog,
      }
    : saved
      ? {
          estimated: saved.estimatedCaloriesPerServing,
          ai: aiCaloriesPerServing,
          confidence: saved.confidence,
          reasoning: saved.reasoning,
          evidence: saved.evidence,
          actionLog: [],
        }
      : null;

  return (
    <section className="mt-8 rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-emerald-900">Nutrition facts verification</h2>
          <p className="text-xs text-emerald-700/70 mt-0.5">
            Browserbase Search → Fetch extracts per-100g macros from the web.
          </p>
        </div>
        <button
          onClick={handleVerify}
          disabled={loading}
          className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 whitespace-nowrap"
        >
          {loading
            ? "Verifying…"
            : summary
              ? "Re-verify with Browserbase"
              : "Verify with Browserbase"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {summary && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-white p-4">
          <NutritionSummary
            estimatedCaloriesPerServing={summary.estimated}
            aiCaloriesPerServing={summary.ai}
            confidence={summary.confidence}
            reasoning={summary.reasoning}
          />
          <NutritionEvidenceTable evidence={summary.evidence} />
        </div>
      )}

      {/* Browserbase Web Agent Console (only after a live run) */}
      {result && result.actionLog.length > 0 && (
        <div className="mt-4 rounded-xl bg-stone-900 p-4 text-stone-100">
          <h3 className="text-sm font-semibold">Browserbase run</h3>
          <p className="mt-1 text-xs text-stone-400">Mode: search+fetch</p>
          <ol className="mt-3 space-y-2 text-xs">
            {result.actionLog.map((entry) => (
              <li key={entry.step}>
                <span className="font-medium">
                  {entry.step}. {entry.action}
                </span>
                <span className="text-stone-400"> — {entry.result}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
