import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { Palate, RefineContext, Wine } from "@/lib/types";
import { REFINE_SCHEMA, SOMM_SYSTEM, palateBlock, refineBlock } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

// Text-only re-ranking of an existing analysis with table context.
// No re-scan, no image — fast by design.
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  let body: { wines?: Wine[]; palates?: Palate[]; context?: RefineContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { wines, palates, context } = body;
  if (!wines?.length || !palates?.length || !context) {
    return NextResponse.json({ error: "Missing wines, palates, or context." }, { status: 400 });
  }

  // Strip fields the model doesn't need for re-scoring.
  const compact = wines.map((w) => ({
    wineId: w.id,
    name: w.name,
    producer: w.producer,
    vintage: w.vintage,
    region: w.region,
    varietals: w.varietals,
    priceText: w.priceText,
    structure: w.structure,
    flavorNotes: w.flavorNotes,
    currentFits: w.fits.map((f) => ({ palateId: f.palateId, score: f.score })),
  }));

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: REFINE_SCHEMA } },
      system: SOMM_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                palateBlock(palates),
                "",
                "TABLE CONTEXT (just provided — re-rank with this in mind):",
                refineBlock(context),
                "",
                "WINES ALREADY IDENTIFIED (from the scan just taken):",
                JSON.stringify(compact),
                "",
                "Re-score every wine for every palate given this table context (pairing with the dishes, matching the occasion and intent). Use each wine's exact wineId and each palate's exact palateId/palateName. Also give one short piece of advice for this table.",
              ].join("\n"),
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Could not refine this result." }, { status: 422 });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No refinement returned." }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error("refine error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Refine failed." },
      { status: 500 },
    );
  }
}
