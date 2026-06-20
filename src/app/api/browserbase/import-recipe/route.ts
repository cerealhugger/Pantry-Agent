import { NextRequest, NextResponse } from "next/server";
import {
  importRecipeWithBrowserbase,
  validateRecipeUrl,
} from "@/lib/browserbase";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  const url = typeof body === "object" && body !== null && "url" in body
    ? (body as { url?: unknown }).url
    : undefined;

  try {
    validateRecipeUrl(url);
    const result = await importRecipeWithBrowserbase(url);
    return NextResponse.json(result, { status: result.status === "succeeded" ? 200 : 422 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid recipe URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
