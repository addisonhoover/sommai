import type { AnalyzeResult, JournalEntry, Palate, PalateFit, Wine, WineLogEntry } from "./types";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\bcab\b/g, "cabernet")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/\bch\.?\b/g, "chateau")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function vintageYear(v: string): string {
  const m = v.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : v.replace(/\D/g, "").slice(0, 4);
}

export function wineIdentity(w: Pick<Wine, "producer" | "name" | "vintage">): string {
  const producer = norm(w.producer);
  const name = norm(w.name);
  const vintage = vintageYear(w.vintage || "");
  const merged =
    producer && name.includes(producer) ? name : [producer, name].filter(Boolean).join(" ");
  if (!merged) return "";
  return vintage ? `${merged} ${vintage}` : merged;
}

export function winesMatch(a: Pick<Wine, "producer" | "name" | "vintage">, b: Pick<Wine, "producer" | "name" | "vintage">): boolean {
  const ia = wineIdentity(a);
  const ib = wineIdentity(b);
  if (ia && ia === ib) return true;

  const pa = norm(a.producer);
  const pb = norm(b.producer);
  const va = vintageYear(a.vintage || "");
  const vb = vintageYear(b.vintage || "");
  if (!pa || pa !== pb) return false;
  if (va && vb && va !== vb) return false;

  const na = norm(a.name);
  const nb = norm(b.name);
  if (!na || !nb) return pa === pb && (!va || !vb || va === vb);
  if (na === nb || na.includes(nb) || nb.includes(na)) return true;

  const ta = new Set(na.split(" ").filter((t) => t.length > 2));
  const tb = nb.split(" ").filter((t) => t.length > 2);
  const overlap = tb.filter((t) => ta.has(t) && t.length > 3).length;
  return overlap >= 1;
}

export function palateFingerprint(ids: string[]): string {
  return [...ids].sort().join(",");
}

// Anthropic structured output rejects array maxItems, so the menu shortlist
// is capped here after the model responds — not in the JSON schema.
export const MENU_SHORTLIST_LIMIT = 3;

export function capMenuWines<T>(wines: T[]): T[] {
  return wines.slice(0, MENU_SHORTLIST_LIMIT);
}

export function stampWineIds(wines: Array<Omit<Wine, "id"> & { id?: string }>): Wine[] {
  const used = new Set<string>();
  return wines.map((w, i) => {
    let id = (w.id && !/^\d+-\d+$/.test(w.id) ? w.id : wineIdentity(w)) || `wine-${i}`;
    if (used.has(id)) id = `${id}·${i}`;
    used.add(id);
    return { ...w, id };
  });
}

export function findPrior(log: WineLogEntry[], wine: Wine): WineLogEntry | undefined {
  const id = wine.id || wineIdentity(wine);
  return (
    log.find((e) => e.wine.id === id || (id && wineIdentity(e.wine) === id)) ||
    log.find((e) => winesMatch(e.wine, wine))
  );
}

function sameSeats(scoredFor: string[], seatedIds: string[]): boolean {
  return palateFingerprint(scoredFor) === palateFingerprint(seatedIds);
}

function reuseNotes(prior: Wine, next: Wine): Pick<Wine, "fits" | "summary" | "flavorNotes" | "terroir" | "pairings" | "structure"> {
  return {
    fits: prior.fits.length ? prior.fits : next.fits,
    summary: prior.summary || next.summary,
    flavorNotes: prior.flavorNotes.length ? prior.flavorNotes : next.flavorNotes,
    terroir: prior.terroir || next.terroir,
    pairings: prior.pairings.length ? prior.pairings : next.pairings,
    structure: prior.structure ?? next.structure,
  };
}

// Once a bottle is recognized for a seated table, keep those Fit Scores
// (and tasting notes) instead of rolling new dice. Palate changes unlock a rescore.
export function lockFits(wines: Wine[], log: WineLogEntry[], seated: Palate[]): Wine[] {
  const seatedIds = seated.map((p) => p.id);
  return stampWineIds(wines).map((w) => {
    const prior = findPrior(log, w);
    if (!prior?.wine.fits.length) return w;
    if (!sameSeats(prior.scoredFor, seatedIds)) return { ...w, id: prior.wine.id || w.id };
    return { ...w, id: prior.wine.id || w.id, ...reuseNotes(prior.wine, w) };
  });
}

export function upsertLog(
  log: WineLogEntry[],
  wines: Wine[],
  sourceType: AnalyzeResult["sourceType"],
  scoredFor: string[],
  mode: "scan" | "refine" = "scan",
): WineLogEntry[] {
  const now = Date.now();
  let next = [...log];
  for (const wine of wines) {
    const prior = findPrior(next, wine);
    if (prior) {
      next = next.map((e) =>
        e === prior
          ? {
              ...e,
              wine: { ...wine, id: e.wine.id || wine.id },
              lastSeen: mode === "scan" ? now : e.lastSeen,
              scanCount: mode === "scan" ? e.scanCount + 1 : e.scanCount,
              scoredFor,
              sourceType: sourceType === "unknown" ? e.sourceType : sourceType,
            }
          : e,
      );
    } else if (mode === "scan") {
      next = [
        {
          wine,
          hearted: false,
          disliked: false,
          firstSeen: now,
          lastSeen: now,
          scanCount: 1,
          scoredFor,
          sourceType,
        },
        ...next,
      ];
    }
  }
  return next;
}

export function toggleHeart(log: WineLogEntry[], wine: Wine): WineLogEntry[] {
  const prior = findPrior(log, wine);
  if (!prior) {
    return [
      {
        wine,
        hearted: true,
        disliked: false,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        scanCount: 1,
        scoredFor: wine.fits.map((f: PalateFit) => f.palateId),
        sourceType: "unknown",
      },
      ...log,
    ];
  }
  return log.map((e) =>
    e === prior ? { ...e, hearted: !e.hearted, disliked: e.hearted ? e.disliked : false } : e,
  );
}

export function toggleDisliked(log: WineLogEntry[], wine: Wine): WineLogEntry[] {
  const prior = findPrior(log, wine);
  if (!prior) return log;
  return log.map((e) => (e === prior ? { ...e, disliked: !e.disliked } : e));
}

export function flagsFor(log: WineLogEntry[], wine: Wine): { hearted: boolean; disliked: boolean } {
  const prior = findPrior(log, wine);
  return { hearted: !!prior?.hearted, disliked: !!prior?.disliked };
}

export type LogSort = "recent" | "hearted" | "fit" | "name";

export function sortLog(entries: WineLogEntry[], sort: LogSort): WineLogEntry[] {
  const copy = [...entries];
  const best = (w: Wine) => Math.max(0, ...w.fits.map((f) => f.score));
  const label = (w: Wine) => [w.producer, w.name].filter(Boolean).join(" ").toLowerCase();
  switch (sort) {
    case "hearted":
      return copy.sort((a, b) => Number(b.hearted) - Number(a.hearted) || b.lastSeen - a.lastSeen);
    case "fit":
      return copy.sort((a, b) => best(b.wine) - best(a.wine) || b.lastSeen - a.lastSeen);
    case "name":
      return copy.sort((a, b) => label(a.wine).localeCompare(label(b.wine)));
    default:
      return copy.sort((a, b) => b.lastSeen - a.lastSeen);
  }
}

export function migrateLog(raw: unknown): WineLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((e: WineLogEntry | JournalEntry) => {
    if (e && typeof e === "object" && "wine" in e && ("hearted" in e || "scanCount" in e)) {
      const row = e as WineLogEntry;
      return {
        wine: row.wine,
        hearted: !!row.hearted,
        disliked: !!row.disliked,
        firstSeen: row.firstSeen || row.lastSeen || Date.now(),
        lastSeen: row.lastSeen || row.firstSeen || Date.now(),
        scanCount: row.scanCount || 1,
        scoredFor: row.scoredFor ?? row.wine.fits?.map((f) => f.palateId) ?? [],
        sourceType: row.sourceType || "unknown",
      };
    }
    const old = e as JournalEntry;
    return {
      wine: old.wine,
      hearted: old.verdict === "loved",
      disliked: old.verdict === "disliked",
      firstSeen: old.savedAt || Date.now(),
      lastSeen: old.savedAt || Date.now(),
      scanCount: 1,
      scoredFor: old.wine?.fits?.map((f) => f.palateId) ?? [],
      sourceType: "unknown" as const,
    };
  });
}

export function compactKnown(log: WineLogEntry[]) {
  return log.slice(0, 60).map((e) => ({
    id: e.wine.id,
    name: e.wine.name,
    producer: e.wine.producer,
    vintage: e.wine.vintage,
    fits: e.wine.fits,
    summary: e.wine.summary,
    scoredFor: e.scoredFor,
  }));
}
