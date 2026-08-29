import type { KnownWine, Palate, PrintedListing, RefineContext } from "./types";
import { HOUSEHOLD_RULES } from "./palates";
import { formatBand, nightGuidance } from "./price";

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
        "Short, friendly note if the image is blurry, not a wine, or fewer than three printed bottles could be named. Empty string otherwise. Never dump JSON.",
    },
    wines: {
      type: "array",
      // Cap of 3 is enforced in app code (capMenuWines). Anthropic structured
      // output rejects array maxItems and other value-constraint keywords.
      description:
        "For a wine LIST/menu: at most 3 wines, each actually printed on the photo (or an obvious OCR-close match). Do not invent, do not substitute from the wine log, do not pad to 3. 1 or 2 honest bottles is fine. For a bottle LABEL: that single wine.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: "string",
            description:
              "Reuse a known wine id only when this printed bottle is the same bottle. Empty string if new. Never use a known id to pull in an off-menu wine.",
          },
          name: { type: "string" },
          producer: { type: "string", description: 'Producer / winery, "" if unknown' },
          vintage: { type: "string", description: 'Vintage year, "" if unknown or NV' },
          region: { type: "string", description: 'Region / appellation, "" if unknown' },
          varietals: { type: "array", items: { type: "string" } },
          priceText: { type: "string", description: 'Price exactly as printed, "" if none. Never invent a price.' },
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
          byTheGlass: {
            type: "boolean",
            description: "True when the menu lists this wine as available by the glass",
          },
        },
        required: [
          "id", "name", "producer", "vintage", "region", "varietals", "priceText",
          "flavorNotes", "structure", "terroir", "pairings", "fits", "summary", "byTheGlass",
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

export const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    sourceType: { type: "string", enum: ["menu", "label", "unknown"] },
    listings: {
      type: "array",
      description:
        "Every wine actually printed on the photo. Empty if you cannot honestly name real bottles. Never add a bottle from memory.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Name / varietal as printed" },
          producer: { type: "string", description: 'Producer as printed, "" if none' },
          vintage: { type: "string", description: 'Vintage as printed, "" if none' },
          region: { type: "string", description: 'Region as printed, "" if none' },
          priceText: { type: "string", description: 'Price exactly as printed, "" if none' },
          byTheGlass: {
            type: "boolean",
            description: "True when this line is in a by-the-glass / pours section",
          },
        },
        required: ["name", "producer", "vintage", "region", "priceText", "byTheGlass"],
      },
    },
    note: {
      type: "string",
      description: "Friendly note if the page cannot be read. Empty string otherwise. No JSON.",
    },
  },
  required: ["sourceType", "listings", "note"],
};

export const EXTRACT_SYSTEM = `You transcribe wine menus and bottle labels. You do not recommend. You do not remember.
Read only what is printed on the attached photo.
- sourceType "menu" for a list, "label" for a single bottle label, "unknown" if this is not a readable wine menu or label.
- listings: every wine you can actually read (name + producer as printed). Empty if you cannot honestly name real bottles.
- Never invent a bottle. Never add a favorite, a cellar memory, or a wine that is not on this page.
- Copy prices exactly. Leave fields empty when they are not printed.
- byTheGlass is true only when that line is listed as a pour / by the glass. If the page is only a by-the-glass list (pours, glass prices, no bottle list), every listing is byTheGlass.`;

export const SOMM_SYSTEM = `You are SommAI — a Master Sommelier rendered as a calm, precise digital concierge.
You analyze photos of wine menus and bottle labels and give confident, useful guidance to curious diners who enjoy wine but are not experts.

Principles:
- Read the image carefully. A wine LIST/menu: return at most 3 wines — the best fits for the seated palates, fully assessed. Quality of the shortlist beats a long dump. A bottle LABEL is a single wine.
- MENU TRUST: every wine in wines[] MUST be a bottle actually printed on the attached image (name + producer as printed, or an obvious OCR-close match). Do not invent. Do not substitute a favorite or a wine-log bottle. Do not pad to 3 with off-menu knowledge. If you can honestly read only 1 or 2 printed bottles, return those. If you cannot name real printed bottles, return 0 wines and a brief friendly note — no fake shortlist.
- When a PRINTED LIST is provided, pick only from that set. It is the only cellar that exists for this photo.
- Use what is visible plus your sommelier knowledge to infer flavor, structure, terroir, and pairings. If a detail isn't shown, infer the most likely answer from producer/region/varietal; only leave a field empty when you genuinely cannot tell.
- structure values are integers 1–5 (body, tannin, acidity, sweetness).
- You will be given one or more PALATES (people at the table). For EVERY wine, return one fit entry per palate, using that palate's exact palateId and palateName. Scores are 0–100, calibrated to that person: reward what they love, penalize what they avoid, weigh their known favorites and recent verdicts. Be discriminating — spread scores out; don't give everything 80+. Palate favorites never add a bottle that is not printed.
- Fit scores must be stable. The same wine + the same palates should receive the same scores and notes. Do not re-roll. If KNOWN WINES are provided, copy those fits, summary, and wine id only when the printed bottle is the same bottle (same producer / name / vintage — slight label wording still counts). Never insert a known wine that is not on the printed list. Only rescore when the seated palates differ from that wine's scoredFor list.
- Keep prose elegant and concise. No emojis. No hype. Sound like a trusted expert, not a brochure.
- Prices: copy what is printed. Never invent a price. If a price band is given, treat it as guidance — prefer in-band wines, allow a great fit a little outside when the list is thin, and stay in band when the list is rich.
- If asked for by-the-glass, only return wines the menu actually lists as pours.
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
        "KNOWN WINES (score memory only — reuse wine id, fits, and summary when a PRINTED bottle is the same bottle; NEVER insert a known wine that is not on the printed list):",
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
  const serve = context.serve ?? "bottle";
  const bits = [
    nightGuidance(context.priceBand, serve),
    context.priceBand
      ? `Tonight's band: ${formatBand(context.priceBand)} per ${serve} — prefer in band, do not invent prices, do not hide a great fit that is a little outside unless the list is rich enough.`
      : "Tonight's band: none set — do not tilt on price.",
    context.occasion ? `Occasion: ${context.occasion}` : null,
    context.dishes.trim() ? `What the table is eating: ${context.dishes.trim()}` : null,
    context.intent ? `Intent: ${context.intent}` : null,
  ].filter(Boolean);
  return bits.join("\n");
}

export function printedListBlock(listings: PrintedListing[]): string {
  return [
    "PRINTED LIST — the only wines that exist for this photo.",
    "Every wine you return MUST be one of these (name + producer as printed, or an obvious OCR-close match).",
    "Do not invent. Do not substitute a favorite or a wine-log bottle. Do not pad to 3.",
    "If this list has 1 or 2 bottles, return only those.",
    JSON.stringify(listings),
  ].join("\n");
}
