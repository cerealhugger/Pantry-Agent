import type { Recipe } from "@/lib/types";

type Props = {
  recipe: Recipe;
  verifying?: boolean;
  error?: string | null;
  onVerify?: () => void;
};

function sourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "nutrition source";
  }
}

export default function MealNutritionCard({
  recipe,
  verifying = false,
  error,
  onVerify,
}: Props) {
  const nutrition = recipe.source_metadata?.nutrition;

  if (!nutrition) {
    return (
      <div className="mt-2 rounded-xl border border-amber/25 bg-amber/10 px-3 py-2 text-[11px]">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <span className="font-semibold text-muted">Estimated calories</span>
          <span className="font-bold text-ink">
            {recipe.calories_per_serving ?? "Unknown"}
            {recipe.calories_per_serving != null ? " kcal / serving" : ""}
          </span>
          <span className="font-semibold text-muted">Source</span>
          <span className="text-ink/70">AI estimate, not browser-verified</span>
          <span className="font-semibold text-muted">Confidence</span>
          <span className="text-ink/70">Unverified</span>
        </div>
        {onVerify && (
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="mt-2 rounded-lg bg-emerald-700 px-2.5 py-1.5 font-bold text-white disabled:opacity-60"
          >
            {verifying ? "Verifying with Browserbase..." : "Verify nutrition facts"}
          </button>
        )}
        {error && <p className="mt-1.5 font-medium text-coral">{error}</p>}
      </div>
    );
  }

  const verifiedEvidence = nutrition.evidence.filter(
    (item) => item.status === "verified" && item.per100g,
  );
  const hasBrowserEvidence = verifiedEvidence.length > 0;
  const sources = [
    ...new Map(
      verifiedEvidence
        .filter((item) => item.sourceUrl)
        .map((item) => [item.sourceUrl, item]),
    ).values(),
  ];

  return (
    <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px]">
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <span className="font-semibold text-emerald-800">Estimated calories</span>
        <span className="font-bold text-ink">
          {nutrition.estimatedCaloriesPerServing ?? "Unknown"}
          {nutrition.estimatedCaloriesPerServing != null ? " kcal / serving" : ""}
        </span>
        <span className="font-semibold text-emerald-800">Source</span>
        <span className="flex flex-wrap gap-x-1.5 text-emerald-800">
          {sources.length > 0 ? (
            sources.slice(0, 3).map((item) => (
              <a
                key={item.sourceUrl}
                href={item.sourceUrl!}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                title={item.sourceTitle ?? item.sourceUrl ?? undefined}
              >
                {sourceLabel(item.sourceUrl!)}
              </a>
            ))
          ) : (
            <span>
              {nutrition.estimationMethod === "ai_fallback"
                ? "AI fallback after Browserbase search"
                : "Browserbase Search + Fetch"}
            </span>
          )}
        </span>
        <span className="font-semibold text-emerald-800">Confidence</span>
        <span className="font-semibold capitalize text-ink">{nutrition.confidence}</span>
      </div>

      <details className="mt-2 border-t border-emerald-200 pt-2">
        <summary className="cursor-pointer font-bold text-emerald-800">
          {hasBrowserEvidence ? "Browser-extracted nutrition evidence" : "Browserbase nutrition search results"} ({verifiedEvidence.length}/{nutrition.evidence.length})
        </summary>
        <div className="mt-2 space-y-1.5">
          {nutrition.evidence.map((item) => (
            <div key={item.ingredient} className="rounded-lg bg-white/80 px-2 py-1.5">
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold capitalize text-ink">{item.ingredient}</span>
                <span className="whitespace-nowrap capitalize text-muted">
                  {item.confidence} confidence
                </span>
              </div>
              {item.per100g ? (
                <p className="mt-0.5 text-ink/70">
                  {item.per100g.calories ?? "?"} kcal/100g | P {item.per100g.protein_g ?? "?"}g | C{" "}
                  {item.per100g.carbs_g ?? "?"}g | F {item.per100g.fat_g ?? "?"}g
                </p>
              ) : (
                <p className="mt-0.5 text-muted">{item.note ?? "No extractable facts found"}</p>
              )}
              {(item.sourceBasis || item.extractedFood) && (
                <p className="mt-0.5 text-muted">
                  {[item.extractedFood, item.sourceBasis].filter(Boolean).join(" | ")}
                </p>
              )}
              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 inline-block text-emerald-700 underline"
                >
                  {sourceLabel(item.sourceUrl)}
                </a>
              )}
            </div>
          ))}
        </div>
      </details>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-emerald-200 pt-2">
        <span className="text-muted">
          Calculated {new Date(nutrition.verifiedAt).toLocaleDateString()}
        </span>
        {onVerify && (
          <button
            type="button"
            onClick={onVerify}
            disabled={verifying}
            className="font-bold text-emerald-800 underline disabled:opacity-60"
          >
            {verifying ? "Re-verifying..." : "Re-verify"}
          </button>
        )}
      </div>
      {error && <p className="mt-1.5 font-medium text-coral">{error}</p>}
    </div>
  );
}
