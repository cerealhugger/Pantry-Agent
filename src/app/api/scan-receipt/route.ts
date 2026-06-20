import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType ?? "image/jpeg",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `You are a grocery receipt parser. Extract all food items from this receipt or grocery photo.

Return ONLY a valid JSON array. No explanation, no markdown, just the array.

Each item must have:
- name: string (e.g. "Spinach", "Chicken Breast")
- quantity: number or null
- unit: string or null (e.g. "g", "pcs", "bag", "ml")
- category: one of "vegetable", "meat", "dairy", "pantry", or "other"
- estimated_shelf_life_days: number (your best estimate of how many days until it expires from today)

Example output:
[
  {"name":"Spinach","quantity":200,"unit":"g","category":"vegetable","estimated_shelf_life_days":5},
  {"name":"Chicken Breast","quantity":500,"unit":"g","category":"meat","estimated_shelf_life_days":3}
]`,
          },
        ],
      },
    ],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  try {
    const items = JSON.parse(text);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to parse Claude response", raw: text }, { status: 500 });
  }
}
