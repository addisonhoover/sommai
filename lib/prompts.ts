import type { KnownWine, Palate, RefineContext } from "./types";
import { HOUSEHOLD_RULES } from "./palates";

// Schema fragment for one wine's per-palate fits.
const FITS_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    properties: {
      palateId: { type: "string" },
      palateName: { type: "string" },
      score: { type: "integer", description: "0–100 fit for this palate" },
      reason: { type: "string", description: "One sentence on why it does or doesn't fit this person" },
    },
    required: ["palateId", "palateName", "score", "reason"],
  },
};

export const WINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceType: { type: "string", enum: ["menu", "label", "unknown"] },
    note: {
      type: "string",
      description:
        "Short, friendly note if the image is blurry, not a wine, or no wine could be identified. Empty string otherwise.",
    },
    wines: {
      type: "array",
      description:
        "For a wine LIST/menu: at most 3 wines — the best fits for the seated palates, fully assessed. For a bottle LABEL: that single wine.",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            description: 'Reuse a known wine id when this is the same bottle. Empty string if new.',
          },
          name: { type: "string" },
          producer: { type: "string", description: 'Producer / winery, "" if unknown' },
          vintage: { type: "string", description: 'Vintage year, "" if unknown or NV' },
          region: { type: "string", description: 'Region / appellation, "" if unknown' },
          varietals: { type: "array", items: { type: "string" } },
          priceText: { type: "string", description: 'Price exactly as printed, "" if none' },
          flavorNotes: { type: "array", items: { type: "string" } },
          structure: {
            type: "object",
            additionalProperties: false,
            properties: {
              body: { type: "integer", enum: [1, 2, 3, 4, 5] },
              tannin: { type: "integer", enum: [1, 2, 3, 4, 5] },
              acidity: { type: "integer", enum: [1, 2, 3, 4, 5] },
              sweetness: { type: "integer", enum: [1, 2, 3, 4, 5] },
            },
            required: ["body", "tannin", "acidity", "sweetness"],
          },
          terroir: { type: "string", description: "1–2 sentences on origin & growing context" },
          pairings: { type: "array", items: { type: "string" } },
          fits: FITS_SCHEMA,
          summary: { type: "string", description: "1–2 sentence elegant tasting summary" },
        },
        required: [
          "id", "name", "producer", "vintage", "region", "varietals", "priceText",
          "flavorNotes", "structure", "terroir", "pairings", "fits", "summary",
        ],
      },
    },
    topPick: { type: "string", description: "Name of the single best overall fit, or empty string" },
  },
  required: ["sourceType", "note", "wines", "topPick"],
};

// Refine returns only re-scored fits per wine, keyed by wine id.
export const REFINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rescored: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          wineId: { type: "string" },
          fits: FITS_SCHEMA,
        },
        required: ["wineId", "fits"],
      },
    },
    topPick: { type: "string" },
    tableNote: {
      type: "string",
      description: "1–2 sentences of sommelier advice for this specific table and context",
    },
  },
  required: ["rescored", "topPick", "tableNote"],
};

// Import digests freeform tasting notes into a structured palate.
export const IMPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", description: "Person's name if evident in the notes, else empty string" },
    summary: { type: "string", description: "A 2–3 sentence portrait of this palate, written like a sommelier's read of a regular" },
    loves: { type: "array", items: { type: "string" } },
    avoids: { type: "array", items: { type: "string" } },
    favoriteWines: { type: "array", items: { type: "string" }, description: "Specific wines, producers, or regions the notes show they love" },
    priceBand: { type: "string", description: 'Typical spend if evident, e.g. "$50–110 on a list", else ""' },
  },
  required: ["name", "summary", "loves", "avoids", "favoriteWines", "priceBand"],
};

export const SOMM_SYSTEM = `You are SommAI — a Master Sommelier rendered as a calm, precise digital concierge.
You analyze photos of wine menus and bottle labels and give confident, useful guidance to curious diners who enjoy wine but are not experts.

Principles:
- Read the image carefully. A wine LIST/menu: return at most 3 wines — the best fits for the seated palates, fully assessed. Quality of the shortlist beats a long dump. A bottle LABEL is a single wine.
- Use what is visible plus your sommelier knowledge to infer flavor, structure, terroir, and pairings. If a detail isn't shown, infer the most likely answer from producer/region/varietal; only leave a field empty when you genuinely cannot tell.
- structure values are integers 1–5 (body, tannin, acidity, sweetness).
- You will be given one or more PALATES (people at the table). For EVERY wine, return one fit entry per palate, using that palate's exact palateId and palateName. Scores are 0–100, calibrated to that person: reward what they love, penalize what they avoid, weigh their known favorites and recent verdicts. Be discriminating — spread scores out; don't give everything 80+.
- Fit scores must be stable. The same wine + the same palates should receive the same scores and notes. Do not re-roll. If KNOWN WINES are provided and you recognize the same bottle (same producer / name / vintage — slight label wording still counts), copy those fits, summary, and wine id instead of inventing new ones. Only rescore when the seated palates differ from that wine's scoredFor list.
- Keep prose elegant and concise. No emojis. No hype. Sound like a trusted expert, not a brochure.
- If the photo is blurry or not a wine menu/label, set sourceType "unknown", return an empty wines array, and put a brief friendly note.`;

export function palateBlock(
  palates: Palate[],
  signal?: { loved: string[]; disliked: string[] },
  known?: KnownWine[],
): string {
  const blocks = palates.map((p) => {
    const lines = [
      `PALATE — palateId: "${p.id}", palateName: "${p.name}"`,
      `Portrait: ${p.summary}`,
      `Loves: ${p.loves.join(", ") || "unknown"}`,
      `Avoids: ${p.avoids.join(", ") || "unknown"}`,
    ];
    if (p.favoriteWines.length) lines.push(`Known favorites: ${p.favoriteWines.join("; ")}`);
    if (p.priceBand) lines.push(`Typical spend: ${p.priceBand}`);
    return lines.join("\n");
  });
  if (palates.some((p) => p.id === "erin" || p.id === "addison" || /^(erin|addison)$/i.test(p.name))) {
    blocks.push(HOUSEHOLD_RULES);
  }
  if (signal && (signal.loved.length || signal.disliked.length)) {
    blocks.push(
      [
        "RECENT WINE LOG VERDICTS (shared table history — treat as live learning signal):",
        signal.loved.length ? `Hearted: ${signal.loved.join("; ")}` : "",
        signal.disliked.length ? `Not for them: ${signal.disliked.join("; ")}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  if (known?.length) {
    blocks.push(
      [
        "KNOWN WINES (already recognized — if you see the same bottle, reuse wine id, fits, and summary; do not invent new scores):",
        JSON.stringify(
          known.map((k) => ({
            wineId: k.id,
            producer: k.producer,
            name: k.name,
            vintage: k.vintage,
            scoredFor: k.scoredFor,
            fits: k.fits,
            summary: k.summary,
          })),
        ),
      ].join("\n"),
    );
  }
  return blocks.join("\n\n");
}

export function refineBlock(context: RefineContext): string {
  const spend = context.spend ?? 50;
  const spendLabel =
    spend <= 35
      ? "cheap night — prefer the more modest bottles that still meet the household floor (never cheap-and-bad)"
      : spend >= 70
        ? "expensive night — prefer the special, celebratory bottles"
        : "as listed — no spend tilt";
  const bits = [
    `Tonight's spend (0 cheap night ↔ 100 expensive night): ${spend} — ${spendLabel}`,
    context.occasion ? `Occasion: ${context.occasion}` : null,
    context.dishes.trim() ? `What the table is eating: ${context.dishes.trim()}` : null,
    context.intent ? `Intent: ${context.intent}` : null,
  ].filter(Boolean);
  return bits.join("\n");
}
