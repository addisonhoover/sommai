import type { PriceBand, ServeStyle, Wine } from "./types";

export const PRICE_FLOOR = 0;
export const PRICE_CEILING = 300;
export const PRICE_STEP = 10;
/** One-night window the slider drags as a unit. Stays this wide at both ends. */
export const BAND_WIDTH = 50;
export const DEFAULT_BAND: PriceBand = { min: PRICE_FLOOR, max: PRICE_FLOOR + BAND_WIDTH };

export function clampBand(min: number, max: number): PriceBand {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const clamp = (n: number) =>
    Math.min(PRICE_CEILING, Math.max(PRICE_FLOOR, Math.round(n / PRICE_STEP) * PRICE_STEP));
  return { min: clamp(lo), max: clamp(hi) };
}

/** Slide a ~$50 window along the track. Does not shrink at the ends. */
export function slideWindow(min: number): PriceBand {
  const stepped = Math.round(min / PRICE_STEP) * PRICE_STEP;
  const lo = Math.min(PRICE_CEILING - BAND_WIDTH, Math.max(PRICE_FLOOR, stepped));
  return { min: lo, max: lo + BAND_WIDTH };
}

export function formatDollars(n: number): string {
  return `$${n}`;
}

export function formatBand(band: PriceBand): string {
  return `${formatDollars(band.min)}–${formatDollars(band.max)}`;
}

export function bandLabel(band: PriceBand | null, serve: ServeStyle = "bottle"): string {
  if (!band) return "Any price · slide to set a band";
  const unit = serve === "glass" ? "glass" : "bottle";
  return `Keep tonight around ${formatBand(band)} / ${unit}`;
}

/** Pull a printed dollar amount out of a menu line. */
export function parseMenuPrice(priceText: string, serve: ServeStyle = "bottle"): number | null {
  const nums = [...priceText.matchAll(/\$?\s*(\d{1,4}(?:\.\d{1,2})?)/g)]
    .map((m) => Number(m[1]))
    .filter((n) => Number.isFinite(n) && n > 0 && n <= 2000);
  if (!nums.length) return null;
  if (nums.length >= 2) {
    const sorted = [...nums].sort((a, b) => a - b);
    return serve === "glass" ? sorted[0]! : sorted[sorted.length - 1]!;
  }
  return nums[0]!;
}

function distanceToBand(price: number | null, band: PriceBand): number {
  if (price == null) return 40;
  if (price >= band.min && price <= band.max) return 0;
  if (price < band.min) return band.min - price;
  return price - band.max;
}

/** Prefer in-band wines. Never drop a pick — this is a guide, not a wall. */
export function preferBand(wines: Wine[], band: PriceBand | null, serve: ServeStyle = "bottle"): Wine[] {
  if (!band || wines.length < 2) return wines;
  return [...wines].sort((a, b) => {
    const da = distanceToBand(parseMenuPrice(a.priceText, serve), band);
    const db = distanceToBand(parseMenuPrice(b.priceText, serve), band);
    if (da !== db) return da - db;
    const sa = Math.max(0, ...a.fits.map((f) => f.score));
    const sb = Math.max(0, ...b.fits.map((f) => f.score));
    return sb - sa;
  });
}

function byFit(a: Wine, b: Wine): number {
  const sa = Math.max(0, ...a.fits.map((f) => f.score));
  const sb = Math.max(0, ...b.fits.map((f) => f.score));
  return sb - sa;
}

/** Best fit first, then tonight's band as a guide. */
export function rankPicks(wines: Wine[], band: PriceBand | null, serve: ServeStyle = "bottle"): Wine[] {
  return preferBand([...wines].sort(byFit), band, serve);
}

export function nightGuidance(band: PriceBand | null, serve: ServeStyle = "bottle"): string {
  const lines: string[] = [];
  if (serve === "glass") {
    lines.push(
      "SERVE: by the glass. Return at most 3 wines this menu lists as available by the glass (glass price, BTG, or a glass column). Use the printed glass price in priceText. If the menu has no pours, return no wines and a short note. Do not invent a glass list.",
    );
  } else {
    lines.push("SERVE: by the bottle. Pick from the bottle list as usual. Do not restrict to glass pours.");
  }
  if (band) {
    lines.push(
      `TONIGHT'S PRICE BAND (guidance, not a hard wall): prefer wines whose PRINTED price is around ${formatBand(band)} per ${serve}. Copy priceText exactly as printed — never invent a price. A great fit a little outside the band may still make the three if the list is thin; if the list is rich, stay in band. Do not hide the only great fit because it is a little over.`,
    );
  }
  return lines.join("\n");
}
