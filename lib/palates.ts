import type { JournalEntry, Palate } from "./types";

// A neutral starter so the very first scan works with zero setup.
export function starterPalate(): Palate {
  return {
    id: "starter",
    name: "My palate",
    active: true,
    summary:
      "Still calibrating — enjoys wine broadly and wants quality, balance, and honest value. Refine this by importing tasting notes or saving wines.",
    loves: ["balance", "typicity", "value", "quality"],
    avoids: ["flaws", "poor value"],
    favoriteWines: [],
    priceBand: "",
    source: "starter",
    updatedAt: Date.now(),
  };
}

// Recent journal verdicts become learning signal for the analyze prompt.
export function learningSignal(journal: JournalEntry[]): {
  loved: string[];
  disliked: string[];
} {
  const label = (e: JournalEntry) =>
    [e.wine.producer, e.wine.name, e.wine.vintage].filter(Boolean).join(" ");
  return {
    loved: journal.filter((e) => e.verdict === "loved").slice(0, 12).map(label),
    disliked: journal.filter((e) => e.verdict === "disliked").slice(0, 6).map(label),
  };
}

// Portable markdown export of a palate — hand it to any third party.
export function palateToMarkdown(p: Palate, journal: JournalEntry[]): string {
  const signal = learningSignal(journal);
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
    lines.push(``, `## Recent verdicts (from the SommAI journal)`);
    signal.loved.forEach((x) => lines.push(`- Loved: ${x}`));
    signal.disliked.forEach((x) => lines.push(`- Not for me: ${x}`));
  }
  return lines.join("\n");
}
