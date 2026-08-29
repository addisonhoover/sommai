"use client";

import { useEffect, useState } from "react";
import type { PriceBand, ServeStyle } from "@/lib/types";
import { shuffleLines } from "@/lib/thinking";
import { PriceBandControl } from "./PriceBandControl";

export function Analyzing({
  image,
  phase = "analyze",
  serve = "bottle",
  band,
  bandTouched,
  showBand = false,
  onBandChange,
}: {
  image: string;
  phase?: "analyze" | "refine" | "glass";
  serve?: ServeStyle;
  band: PriceBand;
  bandTouched: boolean;
  showBand?: boolean;
  onBandChange?: (next: PriceBand) => void;
}) {
  const [lines] = useState(() => shuffleLines());
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % lines.length), 1600);
    return () => clearInterval(t);
  }, [lines.length]);

  const eyebrow =
    phase === "refine"
      ? "SommAI is taking another look"
      : phase === "glass"
        ? "SommAI is tasting"
        : "SommAI is tasting";

  return (
    <div className="flex h-[100dvh] flex-col bg-ink px-8">
      <div className="flex flex-1 flex-col items-center justify-center">
        <div className={`relative overflow-hidden rounded-2xl border border-hairline ${showBand ? "h-52 w-40" : "h-64 w-52"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt="Scanned wine" className="h-full w-full object-cover opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-full">
            <div className="h-px w-full animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-burgundy-light to-transparent bg-[length:200%_100%]" />
          </div>
        </div>
        <p className="eyebrow mt-9">{eyebrow}</p>
        {phase === "glass" && (
          <p className="mt-1 text-center text-[12px] text-faint">The by-the-glass list</p>
        )}
        <p key={`${phase}-${i}`} className="animate-fade-in mt-3 text-center text-[15px] text-cream">
          {lines[i]}
        </p>
      </div>

      {showBand && onBandChange && (
        <div className="w-full max-w-sm self-center pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <p className="eyebrow">Tonight&apos;s band</p>
          <p className="mt-1 text-[12px] leading-relaxed text-faint">
            A guide, not a wall. Skip it and the first three still arrive.
          </p>
          <div className="mt-3">
            <PriceBandControl band={band} touched={bandTouched} serve={serve} onChange={onBandChange} />
          </div>
        </div>
      )}
    </div>
  );
}
