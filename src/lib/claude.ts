import Anthropic from "@anthropic-ai/sdk";
import type { Ingredient } from "./types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type NormalizedRecipe = {
  title: string;
  ingredients: Ingredient[];
  steps: string[];
  calories_per_serving: number | null;
  servings: number;
  tags: string[];
};

export async function normalizeRecipe(rawText: string): Promise<NormalizedRecipe> {
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are a recipe normalizer. Extract a structured recipe from the text below.

Return ONLY valid JSON — no markdown, no explanation.

Schema:
{
  "title": string,
  "ingredients": [{"name": string, "qty": number | null, "unit": string | null}],
  "steps": [string],
  "calories_per_serving": number | null,
  "servings": number,
  "tags": [string]
}

Raw text:
${rawText}`,
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Claude did not return valid JSON");
  const result = JSON.parse(match[0]) as NormalizedRecipe;
  if (!result.title || result.title === "Unknown" || result.ingredients.length === 0) {
    throw new Error("Claude could not find a recipe in the extracted content");
  }
  return result;
}
