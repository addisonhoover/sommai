"use client";

import type { PriceBand, ServeStyle } from "@/lib/types";
import {
  PRICE_CEILING,
  PRICE_FLOOR,
  PRICE_STEP,
  bandLabel,
  clampBand,
  formatDollars,
} from "@/lib/price";

export function PriceBandControl({
  band,
  touched,
  serve = "bottle",
  onChange,
}: {
  band: PriceBand;
  touched: boolean;
  serve?: ServeStyle;
  onChange: (next: PriceBand) => void;
}) {
  const span = PRICE_CEILING - PRICE_FLOOR || 1;
  const left = ((band.min - PRICE_FLOOR) / span) * 100;
  const width = ((band.max - band.min) / span) * 100;
  const active = touched ? band : null;

  const setMin = (raw: number) => {
    onChange(clampBand(Math.min(raw, band.max - PRICE_STEP), band.max));
  };
  const setMax = (raw: number) => {
    onChange(clampBand(band.min, Math.max(raw, band.min + PRICE_STEP)));
  };

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-cream/90">{bandLabel(active, serve)}</p>
      <div className="relative mt-4 h-8">
        <div className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-surface-2" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-burgundy-light"
          style={{ left: `${left}%`, width: `${Math.max(width, 1)}%` }}
        />
        <input
          type="range"
          min={PRICE_FLOOR}
          max={PRICE_CEILING}
          step={PRICE_STEP}
          value={band.min}
          onChange={(e) => setMin(Number(e.target.value))}
          className="band-range"
          aria-label="Lowest price tonight"
          style={{ zIndex: band.min > PRICE_CEILING - 40 ? 5 : 3 }}
        />
        <input
          type="range"
          min={PRICE_FLOOR}
          max={PRICE_CEILING}
          step={PRICE_STEP}
          value={band.max}
          onChange={(e) => setMax(Number(e.target.value))}
          className="band-range"
          aria-label="Highest price tonight"
          style={{ zIndex: 4 }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{formatDollars(PRICE_FLOOR)}</span>
        <span>{formatDollars(PRICE_CEILING)}</span>
      </div>
    </div>
  );
}
