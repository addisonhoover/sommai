// Shared domain types for SommAI v2

export interface WineStructure {
  body: number; // 1 (light) – 5 (full)
  tannin: number; // 1 (soft) – 5 (grippy)
  acidity: number; // 1 (low) – 5 (bright)
  sweetness: number; // 1 (bone dry) – 5 (sweet)
}

// One person's fit verdict on a wine.
export interface PalateFit {
  palateId: string;
  palateName: string;
  score: number; // 0–100
  reason: string; // one sentence
}

export interface Wine {
  id: string;
  name: string;
  producer: string;
  vintage: string;
  region: string;
  varietals: string[];
  priceText: string; // as printed on a menu, "" if unknown
  flavorNotes: string[];
  structure: WineStructure;
  terroir: string;
  pairings: string[];
  fits: PalateFit[]; // one entry per active palate
  summary: string;
}

export interface AnalyzeResult {
  sourceType: "menu" | "label" | "unknown";
  note: string; // populated when the image is unclear or not a wine
  wines: Wine[];
  topPick: string; // name of the best overall fit
}

// A person's palate — rich enough to be bootstrapped from imported notes
// and to keep learning from journal verdicts.
export interface Palate {
  id: string;
  name: string; // "Addison", "Erin"
  active: boolean; // active palates get scored on every scan
  summary: string; // prose portrait of this palate
  loves: string[];
  avoids: string[];
  favoriteWines: string[]; // specific wines/producers/regions known to land
  priceBand: string; // e.g. "$50–110 on a list", "" if unknown
  source: "starter" | "imported" | "learned";
  updatedAt: number;
}

// Post-shot refinement — applied AFTER the first result, never before.
export interface RefineContext {
  occasion: string | null; // Date night, Group dinner, Celebration, Casual
  dishes: string; // free text: "lamb for me, roast chicken for her"
  intent: string | null; // One bottle for the table, By the glass, Something special
}

export interface JournalEntry {
  wine: Wine;
  verdict: "loved" | "disliked";
  savedAt: number;
}
