import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import { normalizeRecipe, type NormalizedRecipe } from "./claude";

export type ActionLogEntry = { step: number; action: string; result: string };

export type BrowserbaseImportResult = {
  status: "succeeded" | "failed";
  inputUrl: string;
  importType: "recipe_url" | "youtube";
  extractionMode: "fetch" | "stagehand";
  browserbaseSessionId?: string;
  browserbaseReplayUrl?: string;
  actionLog: ActionLogEntry[];
  recipe?: NormalizedRecipe;
  rawText?: string;
  errorMessage?: string;
};

function isYouTube(url: string) {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

// ── Fetch path (fast, static pages) ──────────────────────────────────────────

async function fetchExtract(url: string, log: ActionLogEntry[]): Promise<string> {
  log.push({ step: log.length + 1, action: "Browserbase Fetch", result: `Fetching ${url}` });
  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  const html = await resp.text();
  log.push({ step: log.length + 1, action: "Fetch complete", result: `${html.length} chars received` });
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 8000);
}

// ── Stagehand path (dynamic pages, YouTube) ──────────────────────────────────

async function stagehandExtract(
  url: string,
  log: ActionLogEntry[]
): Promise<{ text: string; sessionId: string; replayUrl: string }> {
  log.push({ step: log.length + 1, action: "Launch Browserbase Session", result: "Starting Stagehand session" });

  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY!,
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
    verbose: 0,
  });

  await stagehand.init();
  const sessionId = stagehand.browserbaseSessionID ?? "";
  const replayUrl = sessionId
    ? `https://browserbase.com/sessions/${sessionId}`
    : "";

  log.push({ step: log.length + 1, action: "Session started", result: `ID: ${sessionId}` });

  const context = stagehand.context;
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  log.push({ step: log.length + 1, action: "Page loaded", result: url });

  let text = "";

  if (isYouTube(url)) {
    // Expand description
    try {
      await stagehand.act("click the 'more' or 'Show more' button in the video description if visible");
      log.push({ step: log.length + 1, action: "Expanded description", result: "clicked" });
    } catch {
      log.push({ step: log.length + 1, action: "Expand description", result: "button not found, continuing" });
    }

    // Try to open transcript
    try {
      await stagehand.act("click the '...' more options button under the video, then click 'Show transcript'");
      log.push({ step: log.length + 1, action: "Opened transcript", result: "transcript visible" });
      await page.waitForTimeout(1500);
    } catch {
      log.push({ step: log.length + 1, action: "Transcript", result: "not available, using description only" });
    }

    const extracted = await stagehand.extract(
      "Extract the video title, full description, and transcript text if visible. Include any recipe ingredients or cooking steps mentioned.",
      z.object({
        title: z.string(),
        description: z.string(),
        transcript: z.string().optional(),
      }),
    );
    text = `Title: ${extracted.title}\n\nDescription: ${extracted.description}\n\nTranscript: ${extracted.transcript ?? ""}`;
    log.push({ step: log.length + 1, action: "Extracted content", result: `${text.length} chars` });
  } else {
    // Recipe blog / web page
    try {
      await stagehand.act("click 'Jump to Recipe' or 'Skip to Recipe' button if present");
      log.push({ step: log.length + 1, action: "Clicked Jump to Recipe", result: "navigated to recipe" });
    } catch {
      log.push({ step: log.length + 1, action: "Jump to Recipe", result: "button not found, continuing" });
    }

    const extracted = await stagehand.extract(
      "Extract the full recipe: title, all ingredients with quantities, and all cooking steps in order.",
      z.object({
        title: z.string(),
        ingredients: z.string(),
        steps: z.string(),
      }),
    );
    text = `Title: ${extracted.title}\n\nIngredients: ${extracted.ingredients}\n\nSteps: ${extracted.steps}`;
    log.push({ step: log.length + 1, action: "Extracted recipe", result: `${text.length} chars` });
  }

  await stagehand.close();
  log.push({ step: log.length + 1, action: "Session closed", result: "done" });

  return { text, sessionId, replayUrl };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function importRecipe(url: string): Promise<BrowserbaseImportResult> {
  const log: ActionLogEntry[] = [];
  const importType = isYouTube(url) ? "youtube" : "recipe_url";

  try {
    let rawText: string;
    let sessionId: string | undefined;
    let replayUrl: string | undefined;
    let extractionMode: "fetch" | "stagehand";

    if (isYouTube(url)) {
      // YouTube always needs Stagehand
      const result = await stagehandExtract(url, log);
      rawText = result.text;
      sessionId = result.sessionId;
      replayUrl = result.replayUrl;
      extractionMode = "stagehand";
    } else {
      // Try fetch first, escalate to Stagehand if content is thin
      try {
        rawText = await fetchExtract(url, log);
        extractionMode = "fetch";
        if (rawText.length < 500) {
          log.push({ step: log.length + 1, action: "Fetch result thin", result: "escalating to Stagehand" });
          throw new Error("thin content");
        }
      } catch {
        const result = await stagehandExtract(url, log);
        rawText = result.text;
        sessionId = result.sessionId;
        replayUrl = result.replayUrl;
        extractionMode = "stagehand";
      }
    }

    log.push({ step: log.length + 1, action: "Normalize with Claude", result: "sending to claude-sonnet-4-6" });
    const recipe = await normalizeRecipe(rawText);
    log.push({ step: log.length + 1, action: "Recipe normalized", result: recipe.title });

    return {
      status: "succeeded",
      inputUrl: url,
      importType,
      extractionMode,
      browserbaseSessionId: sessionId,
      browserbaseReplayUrl: replayUrl,
      actionLog: log,
      recipe,
      rawText,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.push({ step: log.length + 1, action: "Error", result: msg });
    return {
      status: "failed",
      inputUrl: url,
      importType,
      extractionMode: "stagehand",
      actionLog: log,
      errorMessage: msg,
    };
  }
}
