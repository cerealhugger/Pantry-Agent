import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function detectMediaType(base64: string): string {
  // check magic bytes from base64 prefix
  const prefix = base64.substring(0, 8);
  const bytes = Buffer.from(prefix, "base64");
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return "image/gif";
  if (bytes[0] === 0x52 && bytes[1] === 0x49) return "image/webp";
  return "image/jpeg";
}

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();

  if (!imageBase64) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: (mediaType && mediaType !== "image/jpeg" ? mediaType : detectMediaType(imageBase64)) as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `You are a grocery receipt parser. Extract only EDIBLE food and beverage items from this receipt.

SKIP everything that is not food: coffee drinks, alcohol, household supplies, cleaning products, laundry detergent, paper goods, personal care, gift cards, bags, taxes, fees, etc.

Return ONLY a valid JSON array. No explanation, no markdown, just the array.

Each item must have:
- name: string (e.g. "Spinach", "Chicken Breast")
- quantity: number or null
- unit: string or null (e.g. "g", "pcs", "bag", "ml", "lb", "oz")
- category: one of "vegetable", "fruit", "meat", "seafood", "dairy", "pantry", or "other"
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
  console.log("Claude raw response:", JSON.stringify(text));
  console.log("Stop reason:", message.stop_reason);

  try {
    // extract the JSON array even if Claude wraps it in markdown or prose
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error("No JSON array found in response");
    const items = JSON.parse(match[0]);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ error: "Failed to parse Claude response", raw: text }, { status: 500 });
  }
}
