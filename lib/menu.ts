import type { AnalyzeResult, PrintedListing, ServeStyle, Wine } from "./types";
import { capMenuWines, stampWineIds, wineIdentity, winesMatch } from "./wine";

export const UNREADABLE_MENU_NOTE =
  "Couldn't read three wines from this menu. Snap again — or get a little closer to one column.";

export const UNREADABLE_LABEL_NOTE =
  "Couldn't read that bottle. Snap again — a closer, well-lit label helps.";

export const NO_GLASS_NOTE = "No by-the-glass pours were listed on that menu.";

export const OFF_PAGE_NOTE =
  "Those picks drifted off the page. Snap again — I'll stay with what's actually printed.";

function normTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t.length > 2);
}

function listingAsWine(listing: PrintedListing): Pick<Wine, "producer" | "name" | "vintage"> {
  return { producer: listing.producer, name: listing.name, vintage: listing.vintage };
}

/** Same bottle, or an obvious OCR-close match of name + producer. */
export function printedMatch(
  wine: Pick<Wine, "producer" | "name" | "vintage">,
  listing: PrintedListing,
): boolean {
  const printed = listingAsWine(listing);
  if (winesMatch(wine, printed)) return true;

  const wineBits = normTokens(`${wine.producer} ${wine.name}`);
  const listBits = normTokens(`${listing.producer} ${listing.name}`);
  if (!wineBits.length || !listBits.length) return false;

  const listSet = new Set(listBits);
  const shared = wineBits.filter((t) => listSet.has(t));
  if (shared.length < 2) return false;

  const wineId = wineIdentity(wine);
  const listId = wineIdentity(printed);
  if (wineId && listId && (wineId.includes(listId) || listId.includes(wineId))) return true;

  const prodWine = normTokens(wine.producer);
  const prodList = new Set(normTokens(listing.producer));
  const prodHit = prodWine.some((t) => prodList.has(t));
  const nameWine = new Set(normTokens(wine.name));
  const nameList = normTokens(listing.name);
  const nameHit = nameList.some((t) => nameWine.has(t));
  return prodHit && nameHit && shared.length >= 2;
}

export function keepPrintedWines(wines: Wine[], listings: PrintedListing[]): Wine[] {
  if (!listings.length) return [];
  return wines.filter((w) => listings.some((l) => printedMatch(w, l)));
}

export function glassListings(listings: PrintedListing[]): PrintedListing[] {
  return listings.filter((l) => l.byTheGlass);
}

export function shortListNote(count: number): string {
  if (count === 1) {
    return "Only one bottle came through clearly. No padding — this is what the page actually showed.";
  }
  if (count === 2) {
    return "Only two bottles came through clearly. No padding — this is what the page actually showed.";
  }
  return "";
}

export function unreadResult(
  sourceType: AnalyzeResult["sourceType"],
  serve: ServeStyle,
  listings: PrintedListing[],
): AnalyzeResult {
  if (sourceType === "menu" && serve === "glass" && listings.length && !glassListings(listings).length) {
    return { sourceType: "menu", note: NO_GLASS_NOTE, wines: [], topPick: "", readFailed: false };
  }
  const label = sourceType === "label";
  return {
    sourceType,
    note: label ? UNREADABLE_LABEL_NOTE : UNREADABLE_MENU_NOTE,
    wines: [],
    topPick: "",
    readFailed: true,
  };
}

export function settlePicks(
  raw: { sourceType?: string; note?: string; wines?: Wine[]; topPick?: string },
  listings: PrintedListing[],
  serve: ServeStyle,
): AnalyzeResult {
  const extractedType: AnalyzeResult["sourceType"] =
    raw.sourceType === "menu" || raw.sourceType === "label" || raw.sourceType === "unknown"
      ? raw.sourceType
      : listings.length > 1
        ? "menu"
        : listings.length === 1
          ? "label"
          : "unknown";

  const sourceType: AnalyzeResult["sourceType"] =
    listings.length > 1 ? "menu" : extractedType;

  const pool =
    sourceType === "menu" && serve === "glass" ? glassListings(listings) : listings;

  if (!pool.length) {
    return unreadResult(sourceType === "unknown" ? "unknown" : sourceType, serve, listings);
  }

  const wines = stampWineIds(capMenuWines(keepPrintedWines(raw.wines ?? [], pool)));
  if (!wines.length) {
    return {
      sourceType,
      note: listings.length ? OFF_PAGE_NOTE : unreadResult(sourceType, serve, listings).note,
      wines: [],
      topPick: "",
      readFailed: true,
    };
  }

  const topPick = wines.some((w) => w.name === raw.topPick) ? raw.topPick || wines[0]!.name : wines[0]!.name;
  const honest =
    sourceType === "menu" && wines.length < 3 ? shortListNote(wines.length) : "";
  const note = (raw.note || "").trim() && wines.length < 3 ? raw.note!.trim() : honest;

  return { sourceType, note, wines, topPick, readFailed: false };
}
