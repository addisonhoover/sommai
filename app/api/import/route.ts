import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { IMPORT_SCHEMA } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 30;

// Digest freeform tasting notes (.md, pasted text, exported lists)
// into a structured palate.
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Server is missing ANTHROPIC_API_KEY." }, { status: 500 });
  }

  let body: { notes?: string; personName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const notes = body.notes?.trim();
  if (!notes) {
    return NextResponse.json({ error: "No notes provided." }, { status: 400 });
  }
  if (notes.length > 200_000) {
    return NextResponse.json({ error: "Notes too large — trim to under 200k characters." }, { status: 413 });
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4096,
      output_config: { format: { type: "json_schema", schema: IMPORT_SCHEMA } },
      system:
        "You are SommAI's palate profiler. You read a person's accumulated wine notes — any format, any length — and distill a precise, structured palate. Be specific: name varietals, regions, producers, and structural preferences the notes actually support. No hype, no emojis.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                body.personName ? `These notes belong to: ${body.personName}` : "",
                "Distill the following wine notes into a structured palate:",
                "",
                notes,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    });

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "Could not process those notes." }, { status: 422 });
    }
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No profile returned." }, { status: 502 });
    }
    return NextResponse.json(JSON.parse(textBlock.text));
  } catch (err) {
    console.error("import error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Import failed." },
      { status: 500 },
    );
  }
}
