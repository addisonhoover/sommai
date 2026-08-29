"use client";

import { useRef } from "react";
import type { PriceBand, ServeStyle } from "@/lib/types";
import {
  BAND_WIDTH,
  PRICE_CEILING,
  PRICE_FLOOR,
  PRICE_STEP,
  bandLabel,
  formatDollars,
  slideWindow,
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
  const trackRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; grab: number } | null>(null);

  const shown = slideWindow(band.min);
  const span = PRICE_CEILING - PRICE_FLOOR || 1;
  const left = ((shown.min - PRICE_FLOOR) / span) * 100;
  const width = (BAND_WIDTH / span) * 100;
  const active = touched ? shown : null;

  const windowAtPointer = (clientX: number, grab: number) => {
    const track = trackRef.current;
    if (!track) return shown;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return shown;
    const bandPx = (BAND_WIDTH / span) * rect.width;
    const origin = clientX - rect.left - grab * bandPx;
    return slideWindow(PRICE_FLOOR + (origin / rect.width) * span);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const bandLeft = (left / 100) * rect.width;
    const bandRight = bandLeft + (width / 100) * rect.width;
    const onBand = x >= bandLeft && x <= bandRight;
    const grab = onBand && bandRight > bandLeft ? (x - bandLeft) / (bandRight - bandLeft) : 0.5;
    dragRef.current = { pointerId: e.pointerId, grab };
    e.currentTarget.setPointerCapture(e.pointerId);
    onChange(windowAtPointer(e.clientX, grab));
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    onChange(windowAtPointer(e.clientX, drag.grab));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(slideWindow(shown.min - PRICE_STEP));
    } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(slideWindow(shown.min + PRICE_STEP));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(slideWindow(PRICE_FLOOR));
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(slideWindow(PRICE_CEILING));
    }
  };

  return (
    <div>
      <p className="text-[13px] leading-relaxed text-cream/90">{bandLabel(active, serve)}</p>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Tonight's price band"
        aria-valuemin={PRICE_FLOOR}
        aria-valuemax={PRICE_CEILING - BAND_WIDTH}
        aria-valuenow={shown.min}
        aria-valuetext={`${formatDollars(shown.min)} to ${formatDollars(shown.max)}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className="price-band relative mt-4 h-9 touch-none select-none outline-none"
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-surface-2" />
        <div
          className="price-band-window pointer-events-none absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full"
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{formatDollars(PRICE_FLOOR)}</span>
        <span>{formatDollars(PRICE_CEILING)}</span>
      </div>
    </div>
  );
}
