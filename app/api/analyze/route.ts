import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { KnownWine, Palate, PriceBand, PrintedListing, ServeStyle } from "@/lib/types";
import { unreadResult, settlePicks } from "@/lib/menu";
import {
  EXTRACT_SCHEMA,
  EXTRACT_SYSTEM,
  SOMM_SYSTEM,
  WINE_SCHEMA,
  palateBlock,
  printedListBlock,
} from "@/lib/prompts";
import { nightGuidance } from "@/lib/price";

export const runtime = "nodejs";
export const maxDuration = 90;

function textOf(message: Anthropic.Message): string | null {
  const block = message.content.find((b) => b.type === "text");
  return block && block.type === "text" ? block.text : null;
}

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
  const photo = { type: "image" as const, source: { type: "base64" as const, media_type: media, data: image } };

  try {
    // Pass 1: transcribe what is printed. No palates, no wine log — they must not invent bottles.
    const extractedMsg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: EXTRACT_SCHEMA } },
      system: EXTRACT_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            photo,
            {
              type: "text",
              text: "Transcribe every wine actually printed on this photo. Do not recommend. Do not add bottles from memory.",
            },
          ],
        },
      ],
    });

    if (extractedMsg.stop_reason === "refusal") {
      return NextResponse.json({ error: "That image could not be analyzed." }, { status: 422 });
    }

    const extractedText = textOf(extractedMsg);
    if (!extractedText) {
      return NextResponse.json({ error: "No analysis returned." }, { status: 502 });
    }

    const extracted = JSON.parse(extractedText) as {
      sourceType?: "menu" | "label" | "unknown";
      listings?: PrintedListing[];
      note?: string;
    };
    const listings = Array.isArray(extracted.listings) ? extracted.listings : [];
    const sourceType = extracted.sourceType ?? (listings.length > 1 ? "menu" : listings.length === 1 ? "label" : "unknown");

    if (sourceType === "unknown" || !listings.length) {
      return NextResponse.json(
        unreadResult(sourceType === "unknown" ? "unknown" : sourceType, serve, listings),
      );
    }

    // Pass 2: pick only from the printed set. Known wines may copy Fit Scores, never add a bottle.
    const pickMsg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: WINE_SCHEMA } },
      system: SOMM_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            photo,
            {
              type: "text",
              text: [
                palateBlock(palates, signal, known),
                "",
                nightGuidance(priceBand ?? null, serve),
                "",
                printedListBlock(listings),
                "",
                "Assess the attached photo. Return at most 3 wines, each drawn from the PRINTED LIST. If the list has 1 or 2, return only those. Never add a wine-log bottle that is not printed.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    if (pickMsg.stop_reason === "refusal") {
      return NextResponse.json({ error: "That image could not be analyzed." }, { status: 422 });
    }

    const pickText = textOf(pickMsg);
    if (!pickText) {
      return NextResponse.json({ error: "No analysis returned." }, { status: 502 });
    }

    const picked = JSON.parse(pickText);
    return NextResponse.json(settlePicks({ ...picked, sourceType }, listings, serve));
  } catch (err) {
    console.error("analyze error:", err);
    const msg = err instanceof Error ? err.message : "Analysis failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
