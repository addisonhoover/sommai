"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalyzeResult, Wine } from "@/lib/types";
import { WineCard } from "./WineCard";
import { CameraIcon, ChevronLeft, TuneIcon } from "./icons";

function bestScore(w: Wine): number {
  return Math.max(0, ...w.fits.map((f) => f.score));
}

const INITIAL_COUNT = 3;

// Results read like a wine list — pages, not a scroll. Up to three picks
// to start; the full list unlocks when the user refines or asks for it.
export function Results({
  result,
  tableNote,
  refined,
  verdicts,
  onSave,
  onScanAgain,
  onOpenRefine,
}: {
  result: AnalyzeResult;
  tableNote: string;
  refined: boolean;
  verdicts: Record<string, "loved" | "disliked">;
  onSave: (wine: Wine, v: "loved" | "disliked") => void;
  onScanAgain: () => void;
  onOpenRefine: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);

  // Refining the table earns the full list.
  useEffect(() => {
    if (refined) setExpanded(true);
  }, [refined]);

  const sorted = useMemo(
    () => [...result.wines].sort((a, b) => bestScore(b) - bestScore(a)),
    [result.wines],
  );
  const shown = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);
  const hidden = sorted.length - shown.length;
  const topName = result.topPick || sorted[0]?.name;

  const onRailScroll = () => {
    const rail = railRef.current;
    if (!rail) return;
    const w = rail.clientWidth;
    if (w > 0) setPage(Math.round(rail.scrollLeft / w));
  };

  const goTo = (i: number) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollTo({ left: i * rail.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="flex h-[100dvh] flex-col bg-ink">
      <header className="z-10 flex items-center justify-between border-b border-hairline bg-ink/80 px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-md">
        <button onClick={onScanAgain} className="flex items-center gap-1.5 text-cream" aria-label="Scan again">
          <ChevronLeft className="h-5 w-5" />
          <span className="text-[14px]">Scan</span>
        </button>
        <p className="wordmark text-[15px]">
          Somm<span className="text-burgundy-light">AI</span>
        </p>
        <button
          onClick={onOpenRefine}
          className="flex items-center gap-1.5 text-burgundy-light"
          aria-label="Refine for this table"
        >
          <TuneIcon className="h-4 w-4" />
          <span className="text-[14px]">Refine</span>
        </button>
      </header>

      {shown.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-10 text-center">
          <p className="text-[15px] leading-relaxed text-muted">
            {result.note ||
              "No wine could be read from that photo. Try again with a clearer, well-lit shot of the menu or label."}
          </p>
          <button
            onClick={onScanAgain}
            className="mt-8 flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink"
          >
            <CameraIcon className="h-5 w-5" />
            Scan again
          </button>
        </div>
      ) : (
        <>
          <div className="px-5 pt-4">
            <p className="eyebrow">
              {expanded
                ? `All ${sorted.length} wines · best fit first`
                : `Top ${shown.length} for your table`}
            </p>
            {tableNote && (
              <p className="animate-fade-in mt-3 rounded-2xl border border-burgundy-light/30 bg-burgundy/10 px-4 py-3 text-[13px] leading-relaxed text-cream/90">
                {tableNote}
              </p>
            )}
          </div>

          {/* the wine-list pager */}
          <div
            ref={railRef}
            onScroll={onRailScroll}
            className="no-scrollbar mt-3 flex flex-1 snap-x snap-mandatory overflow-x-auto"
          >
            {shown.map((w) => (
              <div key={w.id} className="no-scrollbar h-full w-full shrink-0 snap-center overflow-y-auto px-4 pb-4">
                <WineCard
                  wine={w}
                  isTopPick={sorted.length > 1 && w.name === topName}
                  verdict={verdicts[w.id]}
                  onSave={(v) => onSave(w, v)}
                />
                <div className="h-2" />
              </div>
            ))}
            {!expanded && hidden > 0 && (
              <div className="flex h-full w-full shrink-0 snap-center flex-col items-center justify-center px-10">
                <p className="eyebrow">There&apos;s more on the list</p>
                <p className="mt-3 max-w-[26ch] text-center text-[14px] leading-relaxed text-muted">
                  {hidden} more {hidden === 1 ? "wine" : "wines"} were read from this menu.
                </p>
                <button
                  onClick={() => setExpanded(true)}
                  className="mt-6 rounded-full border border-hairline px-6 py-3 text-[14px] text-cream hover:border-burgundy-light/50"
                >
                  Show the full list
                </button>
                <button onClick={onOpenRefine} className="mt-4 text-[13px] text-burgundy-light">
                  or refine for tonight first
                </button>
              </div>
            )}
          </div>

          {/* page dots + scan-again */}
          <div className="flex flex-col items-center gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-1">
            <div className="flex items-center gap-2">
              {Array.from({ length: shown.length + (!expanded && hidden > 0 ? 1 : 0) }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  aria-label={`Page ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === page ? "w-5 bg-burgundy-light" : "w-1.5 bg-hairline"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onScanAgain}
              className="flex items-center gap-2 rounded-full bg-cream px-6 py-3 text-[14px] font-medium text-ink shadow-lg shadow-black/40"
            >
              <CameraIcon className="h-5 w-5" />
              Scan another
            </button>
          </div>
        </>
      )}
    </div>
  );
}
