"use client";

import { useEffect, useState } from "react";

const LINES = [
  "Reading the list…",
  "Decoding terroir & structure…",
  "Weighing each palate…",
  "Composing pairings…",
];

export function Analyzing({ image }: { image: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % LINES.length), 1500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center bg-ink px-8">
      <div className="relative h-64 w-52 overflow-hidden rounded-2xl border border-hairline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt="Scanned wine" className="h-full w-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-full">
          <div className="h-px w-full animate-[shimmer_1.6s_linear_infinite] bg-gradient-to-r from-transparent via-burgundy-light to-transparent bg-[length:200%_100%]" />
        </div>
      </div>
      <p className="eyebrow mt-9">SommAI is tasting</p>
      <p key={i} className="animate-fade-in mt-3 text-[15px] text-cream">
        {LINES[i]}
      </p>
    </div>
  );
}
