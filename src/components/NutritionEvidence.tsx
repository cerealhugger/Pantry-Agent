import type { NutritionEvidence } from "@/lib/types";

const CONFIDENCE_STYLES: Record<string, string> = {
  high: "bg-green-100 text-green-700 border-green-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

export function ConfidenceBadge({
  confidence,
  className = "",
}: {
  confidence: "high" | "medium" | "low";
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
        CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low
      } ${className}`}
    >
      {confidence} confidence
    </span>
  );
}

export function NutritionSummary({
  estimatedCaloriesPerServing,
  aiCaloriesPerServing,
  confidence,
  reasoning,
  hasBrowserEvidence = true,
}: {
  estimatedCaloriesPerServing: number | null;
  aiCaloriesPerServing: number | null;
  confidence: "high" | "medium" | "low";
  reasoning?: string;
  hasBrowserEvidence?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-2xl font-bold text-gray-900">
          {estimatedCaloriesPerServing ?? "?"}
          <span className="text-sm font-normal text-gray-500"> kcal / serving</span>
        </span>
        <ConfidenceBadge confidence={confidence} />
        <span className="text-xs text-emerald-700 font-medium">
          {hasBrowserEvidence ? "Browser evidence attached" : "AI fallback after Browserbase search"}
        </span>
      </div>
      {aiCaloriesPerServing != null &&
        aiCaloriesPerServing !== estimatedCaloriesPerServing && (
          <p className="mt-1 text-xs text-gray-400">
            Original AI estimate: {aiCaloriesPerServing} kcal / serving
          </p>
        )}
      {reasoning && <p className="mt-2 text-xs text-gray-500">{reasoning}</p>}
    </div>
  );
}

export function NutritionEvidenceTable({ evidence }: { evidence: NutritionEvidence[] }) {
  if (evidence.length === 0) return null;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-gray-400">
            <th className="pb-2 font-medium">Ingredient</th>
            <th className="pb-2 font-medium text-right">kcal/100g</th>
            <th className="pb-2 font-medium text-right">P / C / F</th>
            <th className="pb-2 font-medium">Source</th>
            <th className="pb-2 font-medium text-right">Confidence</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {evidence.map((e) => (
            <tr key={e.ingredient} className="text-gray-700">
              <td className="py-2 pr-2 font-medium capitalize">{e.ingredient}</td>
              <td className="py-2 px-2 text-right tabular-nums">
                {e.per100g?.calories ?? "—"}
              </td>
              <td className="py-2 px-2 text-right tabular-nums text-gray-400">
                {e.per100g
                  ? `${e.per100g.protein_g ?? "?"} / ${e.per100g.carbs_g ?? "?"} / ${e.per100g.fat_g ?? "?"}`
                  : "—"}
              </td>
              <td className="py-2 px-2">
                {e.sourceUrl ? (
                  <a
                    href={e.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 underline"
                    title={e.sourceTitle ?? e.sourceUrl}
                  >
                    {hostLabel(e.sourceUrl)} ↗
                  </a>
                ) : (
                  <span className="text-gray-300">{e.note ?? "not found"}</span>
                )}
              </td>
              <td className="py-2 pl-2 text-right">
                <ConfidenceBadge confidence={e.confidence} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}
