import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { KnownWine, Palate, PriceBand, ServeStyle } from "@/lib/types";
import { SOMM_SYSTEM, WINE_SCHEMA, palateBlock } from "@/lib/prompts";
import { nightGuidance } from "@/lib/price";
import { capMenuWines, stampWineIds } from "@/lib/wine";

export const runtime = "nodejs";
export const maxDuration = 45;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Server is missing ANTHROPIC_API_KEY. Add it to .env.local (or Vercel env) and redeploy." },
      { status: 500 },
    );
  }

  let body: {
    image?: string;
    mediaType?: string;
    palates?: Palate[];
    signal?: { loved: string[]; disliked: string[] };
    known?: KnownWine[];
    priceBand?: PriceBand | null;
    serve?: ServeStyle;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { image, mediaType = "image/jpeg", palates, signal, known, priceBand, serve = "bottle" } = body;
  if (!image || !palates?.length) {
    return NextResponse.json({ error: "Missing image or palates." }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
  const media = (allowed as readonly string[]).includes(mediaType)
    ? (mediaType as (typeof allowed)[number])
    : "image/jpeg";

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      temperature: 0,
      output_config: { format: { type: "json_schema", schema: WINE_SCHEMA } },
      system: SOMM_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: media, data: image } },
            {
              type: "text",
              text: `${palateBlock(palates, signal, known)}\n\n${nightGuidance(priceBand ?? null, serve)}\n\nAnalyze the attached photo and return the structured result with one fit per palate on every wine. For a menu, return at most 3 picks.`,
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "That image could not be analyzed." }, { status: 422 });
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No analysis returned." }, { status: 502 });
    }

    const result = JSON.parse(textBlock.text);
    result.wines = stampWineIds(capMenuWines(result.wines ?? []));
    return NextResponse.json(result);
  } catch (err) {
    console.error("analyze error:", err);
    const msg = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
