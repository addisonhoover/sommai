import type { Palate, WineLogEntry } from "./types";

export const ERIN_ID = "erin";
export const ADDISON_ID = "addison";
export const DEFAULT_TABLE = [ERIN_ID, ADDISON_ID];

// Baked 2026-08-29 from Addison's combined notes. Stable timestamp so
// a fresh open doesn't flash "Still calibrating."
const BAKED_AT = Date.UTC(2026, 7, 29);

const SHARED_LOVES = [
  "complete mid-palate",
  "polished structure",
  "fruit-present (not jammy)",
  "French oak",
  "Napa Cabernet",
  "Bordeaux varieties",
  "lean modern Brunello",
  "Cab Franc blends",
  "Right Bank Bordeaux",
  "softer Oak Knoll Napa",
  "Rhône / Syrah (B Cellars Hudson Vineyard)",
];

const SHARED_AVOIDS = [
  "thin or hollow mid-palate",
  "green / underripe",
  "jammy fruit",
  "inexpensive wine",
  "sub-$20 Rioja Reserva unless La Rioja Alta, CVNE Imperial, or Muga",
  "Napa 2020 smoke years, especially Petit Verdot",
  "Urbión Rioja Reserva 2015 (meh)",
];

const SHARED_FAVORITES = [
  "Stag's Leap Wine Cellars Artemis Cabernet 2022 (Fay is the upgrade)",
  "Frank Family Cabernet",
  "Rockmere Cabernet 2019 (also the 2018 / 2021 / 2022 vertical)",
  "Del Dotto Pinot Noir",
  "Arietta Merlot 2019",
  "Aviara Prana Cabernet 2020",
  "DeLille Métier Cabernet 2021",
  "Chateau Ste. Michelle Artist Series 2022",
  "Chateau Ste. Michelle Cabernet Franc 2021",
  "Caparzo Brunello",
  "Viña Alberdi Reserva 2020",
  "Château Mauvinon Saint-Émilion 2020 (weekday)",
  "Bianchi IV Generación Gran Corte 2020 (liked, reorder)",
  "Raymond Coombsville Cabernet 2019 (liked)",
];

const PRICE_BAND =
  "$100–325 on Napa when picking freely; high floor everywhere — cheap wine is a hard no";

export const HOUSEHOLD_RULES = `HOUSEHOLD RULES (Addison & Erin — apply whenever either is seated):
- Hard floor: no inexpensive wine. Skip sub-$20 Rioja Reserva unless a polished modern house (La Rioja Alta, CVNE Imperial, Muga).
- Vintage: Napa 2021 is the apex; 2019 and 2018 excellent; 2022 variable (heat-dome); avoid 2020 smoke by default, especially Petit Verdot.
- Shared loves: Stag's Leap Artemis Cabernet 2022 (Fay is the upgrade); lean modern Brunello; Cab Franc blends; Right Bank Bordeaux; softer Oak Knoll Napa; Rhône/Syrah (B Cellars Hudson Vineyard).
- Verified: Bianchi IV Generación Gran Corte 2020 liked, reorder; Raymond Coombsville Cabernet 2019 liked; Urbión Rioja Reserva 2015 meh — skip.
- Erin's tell is the mid-palate — a hollow middle fails her. Addison shares that core and will go further into earthy, savory, herbal Old World.`;

export function householdPalates(): Palate[] {
  return [
    {
      id: ERIN_ID,
      name: "Erin",
      active: true,
      summary:
        "Polished, fruit-present, structured wines with a complete mid-palate — that middle is the tell, and a hollow one fails her. French oak is welcome. Home base is Napa Cabernet and Bordeaux varieties. Thin, green, jammy, or inexpensive wine is a hard no.",
      loves: SHARED_LOVES,
      avoids: SHARED_AVOIDS,
      favoriteWines: [
        ...SHARED_FAVORITES,
        "Sequoia Grove Cabernet 2017 Lamoreaux Vineyard (likes; Addison loves it)",
      ],
      priceBand: PRICE_BAND,
      source: "household",
      updatedAt: BAKED_AT,
    },
    {
      id: ADDISON_ID,
      name: "Addison",
      active: true,
      summary:
        "Same core as Erin — polished, structured, complete mid-palate, Napa Cab and Bordeaux varieties — with a wider aperture toward earthy, savory, herbal Old World. He will go further into Brunello, earth, and herbal Cab Franc than she will. Same high price floor; inexpensive wine is out.",
      loves: [
        ...SHARED_LOVES,
        "earthy / savory Old World",
        "herbal Cab Franc",
        "Altesino Brunello",
      ],
      avoids: SHARED_AVOIDS,
      favoriteWines: [
        "Altesino Brunello di Montalcino 2020 (solo pick)",
        "Sequoia Grove Cabernet 2017 Lamoreaux Vineyard (loves it; Erin likes it)",
        ...SHARED_FAVORITES,
      ],
      priceBand: PRICE_BAND,
      source: "household",
      updatedAt: BAKED_AT,
    },
  ];
}

function isStarter(p: Palate): boolean {
  return p.source === "starter" || p.id === "starter" || /^my palate$/i.test(p.name);
}

function cleanName(name: string): string {
  return name.trim().toLowerCase().replace(/['’]/g, "");
}

export function isIndividualSeat(p: Palate, person: "Erin" | "Addison"): boolean {
  return cleanName(p.name) === person.toLowerCase();
}

/** Last night's combined markdown — one card for two people. Never a table seat. */
export function isCoupleProfile(p: Palate): boolean {
  const n = cleanName(p.name);
  if (n === "erin" || n === "addison") return false;
  if (/\berin\b/.test(n) && /\baddison\b/.test(n)) return true;
  if (/\bcouples?\b/.test(n) || /\bour palate\b/.test(n) || /\bhousehold\b/.test(n)) return true;
  const blob = p.summary.toLowerCase().replace(/['’]/g, "");
  if (/\bcouples?\s+palate\b/.test(blob)) return true;
  return false;
}

function bakedFor(person: "Erin" | "Addison"): Palate {
  return householdPalates().find((p) => p.name === person)!;
}

// Two people, two seats. A combined "Erin & Addison" import must not own the table.
export function ensureHousehold(stored: Palate[] | null): { palates: Palate[]; defaultTable: string[] } {
  const baked = householdPalates();
  if (!stored?.length || stored.every(isStarter)) {
    return { palates: baked, defaultTable: [...DEFAULT_TABLE] };
  }

  const usable = stored.filter((p) => !isStarter(p) && !isCoupleProfile(p));
  const erinStored = usable.find((p) => isIndividualSeat(p, "Erin"));
  const addisonStored = usable.find((p) => isIndividualSeat(p, "Addison"));
  const extras = usable.filter(
    (p) => !isIndividualSeat(p, "Erin") && !isIndividualSeat(p, "Addison"),
  );

  if (!erinStored && !addisonStored) {
    return { palates: baked, defaultTable: [...DEFAULT_TABLE] };
  }

  let erin = erinStored ?? bakedFor("Erin");
  let addison = addisonStored ?? bakedFor("Addison");
  if (!erinStored) erin = { ...erin, active: true };
  if (!addisonStored) addison = { ...addison, active: true };
  if (!erin.active && !addison.active) {
    erin = { ...erin, active: true };
    addison = { ...addison, active: true };
  }

  return {
    palates: [erin, addison, ...extras],
    defaultTable: [erin.id, addison.id],
  };
}

export function learningSignal(log: WineLogEntry[]): {
  loved: string[];
  disliked: string[];
} {
  const label = (e: WineLogEntry) =>
    [e.wine.producer, e.wine.name, e.wine.vintage].filter(Boolean).join(" ");
  return {
    loved: log.filter((e) => e.hearted).slice(0, 12).map(label),
    disliked: log.filter((e) => e.disliked).slice(0, 6).map(label),
  };
}

export function palateToMarkdown(p: Palate, log: WineLogEntry[]): string {
  const signal = learningSignal(log);
  const lines = [
    `# Wine palate — ${p.name}`,
    ``,
    `_Exported from SommAI on ${new Date().toISOString().slice(0, 10)}_`,
    ``,
    `## Portrait`,
    p.summary,
    ``,
    `## Loves`,
    ...p.loves.map((x) => `- ${x}`),
    ``,
    `## Avoids`,
    ...p.avoids.map((x) => `- ${x}`),
  ];
  if (p.favoriteWines.length) {
    lines.push(``, `## Known favorites`, ...p.favoriteWines.map((x) => `- ${x}`));
  }
  if (p.priceBand) {
    lines.push(``, `## Typical spend`, p.priceBand);
  }
  if (signal.loved.length || signal.disliked.length) {
    lines.push(``, `## Recent verdicts (from the SommAI wine log)`);
    signal.loved.forEach((x) => lines.push(`- Hearted: ${x}`));
    signal.disliked.forEach((x) => lines.push(`- Not for me: ${x}`));
  }
  return lines.join("\n");
}
